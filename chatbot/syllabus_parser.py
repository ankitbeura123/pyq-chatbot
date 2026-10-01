import os
import json

from .rag import collection
from .gemini_utils import call_gemini_json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SYLLABUS_CACHE_DIR = os.path.join(BASE_DIR, "syllabus_cache")
os.makedirs(SYLLABUS_CACHE_DIR, exist_ok=True)


def _cache_path(subject_name):
    safe = "".join(c if c.isalnum() else "_" for c in subject_name)
    return os.path.join(SYLLABUS_CACHE_DIR, f"{safe}.json")


def get_raw_syllabus_text(subject_name):
    """Fetch the syllabus doc for a subject directly from ChromaDB."""
    results = collection.get(
        where={"$and": [{"subject": {"$eq": subject_name}}, {"doc_type": {"$eq": "syllabus"}}]},
        include=["documents"]
    )
    docs = results.get("documents", [])
    if not docs:
        return None
    return "\n".join(docs)


def parse_syllabus_structure(subject_name, force_refresh=False):
    """
    Returns: {"units": [{"unit": "Unit 1", "title": "...", "topics": ["...", ...]}, ...]}
    Cached to disk per subject. Uses Gemini to structure the raw syllabus text
    that was actually ingested into ChromaDB — never invents units.
    """
    cache_file = _cache_path(subject_name)
    if not force_refresh and os.path.exists(cache_file):
        with open(cache_file, "r", encoding="utf-8") as f:
            return json.load(f)

    raw_text = get_raw_syllabus_text(subject_name)
    if not raw_text or not raw_text.strip():
        return {"units": [], "error": "No syllabus ingested for this subject yet."}

    prompt = f"""You are parsing a college course syllabus into a strict structure.

Raw syllabus text:
---
{raw_text}
---

Extract the ACTUAL units/modules exactly as they appear in this text (do not invent
anything not present). For each unit, list the topic names/subtopics mentioned under it.
If the syllabus doesn't use the word "Unit", use whatever division it actually uses
(Module, Chapter, Section) but label it "Unit N" in the output for consistency, where N
is its position order.

Respond with ONLY valid JSON, no markdown fences, no commentary, in this exact shape:
{{
  "units": [
    {{"unit": "Unit 1", "title": "<short title from syllabus>", "topics": ["<topic 1>", "<topic 2>"]}},
    ...
  ]
}}
"""
    structure = call_gemini_json(prompt)
    if "units" not in structure:
        structure = {"units": []}

    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(structure, f, indent=2)

    return structure


def flat_topic_list(structure):
    """Returns list of (unit_label, topic) tuples for prompting the classifier."""
    out = []
    for u in structure.get("units", []):
        for t in u.get("topics", []):
            out.append((u["unit"], t))
    return out