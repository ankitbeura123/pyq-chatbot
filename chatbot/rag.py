import os
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


def retrieve_relevant_chunks(query, subject_filter=None, top_k=8):
    """Embed the query and search ChromaDB for similar chunks."""
    query_embedding = embedder.encode(query).tolist()

    where_clause = {"subject": subject_filter} if subject_filter else None

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        where=where_clause
    )

    chunks = []
    if results["documents"] and results["documents"][0]:
        for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
            chunks.append({"text": doc, "metadata": meta})
    return chunks


def build_prompt(user_question, retrieved_chunks):
    """Construct the prompt sent to Gemini, including retrieved context."""
    context_parts = []
    for chunk in retrieved_chunks:
        meta = chunk["metadata"]
        source_info = f"[{meta.get('doc_type', 'unknown')} | {meta.get('subject', '')} | Year: {meta.get('year', 'N/A')} | {meta.get('exam_type', 'N/A')} | Q{meta.get('question_number', '')}]"
        context_parts.append(f"{source_info}\n{chunk['text']}")

    context_text = "\n\n---\n\n".join(context_parts)

    prompt = f"""You are an exam preparation assistant helping a college student study using previous year question papers (PYQs) and the course syllabus.

Below is relevant context retrieved from the student's PYQ database and syllabus:

{context_text}

Student's question: {user_question}

Instructions:
- If the student is asking for probable/likely exam questions, analyze patterns across the PYQs provided and suggest topics or specific question types that are likely to appear, referencing which years/exams they've appeared in.
- If asking for insight on a specific question or topic, explain the concept clearly and mention how it has been asked in the past.
- Be specific and reference the actual retrieved questions where relevant.
- If the context doesn't have enough information to answer confidently, say so honestly rather than making things up.
- Keep your answer focused and well-organized.
"""
    return prompt


def get_chatbot_response(user_question, subject_filter=None):
    """Full RAG pipeline: retrieve, build prompt, call Gemini, return answer."""
    chunks = retrieve_relevant_chunks(user_question, subject_filter=subject_filter)

    if not chunks:
        return "I couldn't find any relevant PYQs or syllabus content for this question. Try rephrasing, or check if the subject has been ingested."

    prompt = build_prompt(user_question, chunks)

    try:
        response = gemini_model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"Error calling Gemini API: {e}"