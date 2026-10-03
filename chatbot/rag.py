import os
import re
import chromadb
from sentence_transformers import SentenceTransformer
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

from .gemini_utils import call_gemini_text, _ensure_configured

_ensure_configured()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROMA_PATH = os.path.join(BASE_DIR, "chroma_db")

_embedder = None


def get_embedder():
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer('all-MiniLM-L6-v2')
    return _embedder


chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
collection = chroma_client.get_or_create_collection(name="pyq_chunks")


def extract_query_filters(query):
    """Detect year, exam type, and question number mentioned in the user's query."""
    filters = {}

    year_match = re.search(r"\b(19|20)\d{2}\b", query)
    if year_match:
        filters["year"] = int(year_match.group())

    query_lower = query.lower()
    if "mid" in query_lower:
        filters["exam_type"] = "Midsem"
    elif "end" in query_lower:
        filters["exam_type"] = "Endsem"

    q_match = re.search(r"q(?:uestion)?\s*\.?\s*(\d{1,2})\s*\(?([a-j])?\)?", query_lower)
    if q_match:
        num, letter = q_match.groups()
        filters["question_number"] = f"{num}({letter})" if letter else num

    return filters


def detect_subject_from_query(query):
    """Check if any known subject name appears in the user's query text."""
    try:
        from .models import Subject
        query_lower = query.lower()
        all_subjects = Subject.objects.values_list('name', flat=True).distinct()
        for subject_name in all_subjects:
            if subject_name.lower() in query_lower:
                return subject_name
    except Exception:
        pass
    return None


def build_where_clause(subject_filter, query_filters):
    """Combine subject + detected filters into a ChromaDB-compatible where clause."""
    conditions = []
    if subject_filter:
        conditions.append({"subject": subject_filter})
    if query_filters.get("year"):
        conditions.append({"year": query_filters["year"]})
    if query_filters.get("exam_type"):
        conditions.append({"exam_type": query_filters["exam_type"]})
    if query_filters.get("question_number"):
        conditions.append({"question_number": query_filters["question_number"]})

    if not conditions:
        return None
    if len(conditions) == 1:
        return conditions[0]
    return {"$and": conditions}


def retrieve_relevant_chunks(query, subject_filter=None, top_k=12):
    """Embed the query and search ChromaDB, using exact filters when detected."""
    try:
        query_embedding = get_embedder().encode(query).tolist()
    except Exception as e:
        print(f"Error encoding query: {e}")
        query_embedding = [0.0] * 384

    query_filters = extract_query_filters(query)

    if not subject_filter:
        detected_subject = detect_subject_from_query(query)
        if detected_subject:
            subject_filter = detected_subject

    where_clause = build_where_clause(subject_filter, query_filters)

    chunks = []
    try:
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where=where_clause
        )
        if results["documents"] and results["documents"][0]:
            for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
                chunks.append({"text": doc, "metadata": meta})
    except Exception as e:
        print(f"ChromaDB query with strict where failed: {e}")

    # Fallback 1: retry with just subject filter if strict filters found nothing
    if not chunks and subject_filter:
        try:
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k,
                where={"subject": subject_filter}
            )
            if results["documents"] and results["documents"][0]:
                for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
                    chunks.append({"text": doc, "metadata": meta})
        except Exception as e:
            print(f"ChromaDB subject fallback failed: {e}")

    # Fallback 2: global search without filter if still no chunks
    if not chunks:
        try:
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k
            )
            if results["documents"] and results["documents"][0]:
                for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
                    chunks.append({"text": doc, "metadata": meta})
        except Exception as e:
            print(f"ChromaDB global search failed: {e}")

    return chunks, query_filters


def build_prompt(user_question, retrieved_chunks, query_filters):
    context_parts = []
    for chunk in retrieved_chunks:
        meta = chunk.get("metadata", {})
        source_info = f"[{meta.get('doc_type', 'unknown')} | {meta.get('subject', '')} | Year: {meta.get('year', 'N/A')} | {meta.get('exam_type', 'N/A')} | Q{meta.get('question_number', '')}]"
        context_parts.append(f"{source_info}\n{chunk['text']}")

    context_text = "\n\n---\n\n".join(context_parts) if context_parts else "No specific context available."

    filter_note = ""
    if query_filters:
        filter_note = f"\n(Note: the student's query appears to reference: {query_filters}. Prioritize matching content if present in context above.)"

    prompt = f"""You are an exam preparation assistant helping a college student study using previous year question papers (PYQs) and the course syllabus.

Below is relevant context retrieved from the student's PYQ database and syllabus:

{context_text}
{filter_note}

Student's query: {user_question}

Instructions:
1. Adapt to the Student's Intent:
   - TOPIC / CONCEPT / SYLLABUS QUERIES (e.g. "10 most probable topics", "important topics", "explain topic X", "overview of unit 2"):
     * Focus on providing a clean, prioritized breakdown of the topics with concise explanations and why they are important based on exam patterns.
     * Do NOT generate long forced question-and-answer blocks here; focus directly on the topic analysis and explanations. You can mention brief reference question titles if relevant.

   - QUESTION / PRACTICE / PYQ LOOKUP QUERIES (e.g. "give me questions on this topic", "most probable questions", "what was the question from midsem 2024", "solve Q2"):
     * Clearly list each question (e.g. Q1, Q2, etc.).
     * Provide the complete step-by-step solution for each question immediately below it inside a collapsible HTML block:
       <details>
       <summary>Show Answer</summary>

       **Solution:**
       [Provide step-by-step answer, formulas, explanation, or code]

       </details>

   - DIRECT EXPLANATION QUERIES (e.g. "What is X?", "Compare A and B"):
     * Provide a direct, well-structured, clear explanation with bullet points and examples.

2. Guidelines:
   - If the exact year or question requested is not in the retrieved context, state so honestly, then provide the closest available match from the syllabus/PYQ records.
   - Do not use raw LaTeX formatting (no $ symbols or \\frac, \\times etc.). Write equations in clean readable text (e.g. "Tm = ΔH / ΔS" or "k2/k1 = ...").
   - Reference actual PYQ years and exam types where relevant.
   - Keep the answer structured, focused, and student-friendly.
"""
    return prompt


def get_chatbot_response(user_question, subject_filter=None):
    chunks, query_filters = retrieve_relevant_chunks(user_question, subject_filter=subject_filter)
    prompt = build_prompt(user_question, chunks, query_filters)

    try:
        return call_gemini_text(prompt)
    except Exception as e:
        return f"Error contacting AI service: {str(e)}"