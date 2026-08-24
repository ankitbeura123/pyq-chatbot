import os
import re
import chromadb
from sentence_transformers import SentenceTransformer
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
gemini_model = genai.GenerativeModel("gemini-3.6-flash")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROMA_PATH = os.path.join(BASE_DIR, "chroma_db")

embedder = SentenceTransformer('all-MiniLM-L6-v2')
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
    from .models import Subject
    query_lower = query.lower()
    all_subjects = Subject.objects.values_list('name', flat=True).distinct()
    for subject_name in all_subjects:
        if subject_name.lower() in query_lower:
            return subject_name
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
    query_embedding = embedder.encode(query).tolist()
    query_filters = extract_query_filters(query)

    if not subject_filter:
        detected_subject = detect_subject_from_query(query)
        if detected_subject:
            subject_filter = detected_subject

    where_clause = build_where_clause(subject_filter, query_filters)

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        where=where_clause
    )

    chunks = []
    if results["documents"] and results["documents"][0]:
        for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
            chunks.append({"text": doc, "metadata": meta})

    # Fallback: if a strict filter found nothing, retry with just the subject filter
    fallback_where = {"subject": subject_filter} if subject_filter else None
    if not chunks and where_clause != fallback_where:
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where=fallback_where
        )
        if results["documents"] and results["documents"][0]:
            for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
                chunks.append({"text": doc, "metadata": meta})

    return chunks, query_filters


def build_prompt(user_question, retrieved_chunks, query_filters):
    context_parts = []
    for chunk in retrieved_chunks:
        meta = chunk["metadata"]
        source_info = f"[{meta.get('doc_type', 'unknown')} | {meta.get('subject', '')} | Year: {meta.get('year', 'N/A')} | {meta.get('exam_type', 'N/A')} | Q{meta.get('question_number', '')}]"
        context_parts.append(f"{source_info}\n{chunk['text']}")

    context_text = "\n\n---\n\n".join(context_parts)

    filter_note = ""
    if query_filters:
        filter_note = f"\n(Note: the student's query appears to reference: {query_filters}. Prioritize matching content if present in context above.)"

    prompt = f"""You are an exam preparation assistant helping a college student study using previous year question papers (PYQs) and the course syllabus.

Below is relevant context retrieved from the student's PYQ database and syllabus:

{context_text}
{filter_note}

Student's question: {user_question}

Instructions:
- If the student is asking for probable/likely exam questions, analyze patterns across the PYQs provided and suggest topics or specific question types that are likely to appear, referencing which years/exams they've appeared in.
- If asking for insight on a specific question or topic, explain the concept clearly and mention how it has been asked in the past.
- If the student asks for "the answer" to a specific past question, note that PYQ papers typically contain only questions, not official solutions — but you can still provide a well-reasoned answer to the question yourself, clearly stating it's your own explanation, not an official answer key.
- If the exact year/question requested isn't in the retrieved context, say so honestly, then offer the closest available match instead of refusing entirely.
- Do not use LaTeX formatting (no $ symbols or \\frac, \\times etc.). Write formulas and equations in plain readable text instead, e.g. "Tm = ΔH / ΔS" or "k2/k1 = ...".
- Be specific and reference the actual retrieved questions where relevant.
- Keep your answer focused and well-organized.
"""
    return prompt


def get_chatbot_response(user_question, subject_filter=None):
    chunks, query_filters = retrieve_relevant_chunks(user_question, subject_filter=subject_filter)

    if not chunks:
        return "I couldn't find any relevant PYQs or syllabus content for this question. Try rephrasing, or check if the subject has been ingested."

    prompt = build_prompt(user_question, chunks, query_filters)

    try:
        response = gemini_model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"Error calling Gemini API: {e}"