import os
import re
import logging
from .gemini_utils import call_gemini_json
from .rag import collection, get_embedder
from .models import Subject
from .syllabus_parser import parse_syllabus_structure

logger = logging.getLogger(__name__)

# Subject alias dictionary mapping common acronyms / alternative names to DB subject names
SUBJECT_ALIASES = {
    "dsa": "Data Structure",
    "ds": "Data Structure",
    "data structures": "Data Structure",
    "data structure": "Data Structure",
    "daa": "Data and Algorithm Analysis",
    "algo": "Data and Algorithm Analysis",
    "algorithms": "Data and Algorithm Analysis",
    "algorithm analysis": "Data and Algorithm Analysis",
    "se": "Software Engineering",
    "software engineering": "Software Engineering",
    "os": "OS",
    "operating systems": "OS",
    "operating system": "OS",
    "dbms": "DBMS",
    "database": "DBMS",
    "cn": "Computer Network",
    "computer networks": "Computer Network",
    "computer network": "Computer Network",
    "coa": "Computer Organisation and Architecture",
    "co": "Computer Organisation and Architecture",
    "ai": "Artificial Intelligence",
    "artificial intelligence": "Artificial Intelligence",
    "ml": "Machine Learning",
    "machine learning": "Machine Learning",
    "dl": "Deep Learning",
    "deep learning": "Deep Learning",
    "nlp": "Natural Language Processing",
    "toc": "Automata and Formal Language",
    "flat": "Automata and Formal Language",
    "automata": "Automata and Formal Language",
    "cloud": "Cloud Computing",
    "cloud computing": "Cloud Computing",
    "cybersecurity": "Cybersecurity",
    "cyber security": "Cybersecurity",
    "hci": "Human Computer Interaction",
    "hpc": "High Performance Computing",
    "oops": "Object oriented Programming Java",
    "java": "Object oriented Programming Java",
    "dm": "Discrete Maths",
    "discrete maths": "Discrete Maths",
    "discrete mathematics": "Discrete Maths",
    "dsd": "Digital System Design",
    "spm": "Software Project Management",
    "evs": "EVS",
    "dmdw": "Data Mining and Data Warehouse",
    "dos": "Distributed Operating System",
}

STOPWORDS = {
    'quiz', 'test', 'questions', 'question', 'exam', 'give', 'make', 'create', 'with', 
    'from', 'about', 'fine', 'allowed', 'syllabus', 'into', 'both', 'only', 'all', 
    'methods', 'method', 'concepts', 'concept', 'types', 'type', 'and', 'the', 'for', 
    'based', 'using', 'solve', 'practice', 'mcq', 'mcqs', 'please', 'generate', 'write',
    'some', 'any', 'that', 'this', 'have', 'find'
}


class QuizGenerationError(Exception):
    pass


def detect_subjects_in_prompt(prompt_text):
    """Detect if any specific subject name or common alias is mentioned in the prompt."""
    prompt_lower = prompt_text.lower()
    try:
        all_subjects = list(Subject.objects.values_list('name', flat=True).distinct())
    except Exception:
        all_subjects = []

    matched = set()

    # 1. Exact DB subject names
    for s in all_subjects:
        pattern = r'\b' + re.escape(s.lower()) + r'\b'
        if re.search(pattern, prompt_lower):
            matched.add(s)

    # 2. Aliases and abbreviations
    for alias, sname in sorted(SUBJECT_ALIASES.items(), key=lambda x: len(x[0]), reverse=True):
        pattern = r'\b' + re.escape(alias) + r'\b'
        if re.search(pattern, prompt_lower):
            matched.add(sname)

    return list(matched)


def check_out_of_syllabus_permitted(prompt_text):
    """Detect if user explicitly allows out-of-syllabus questions in the prompt."""
    prompt_lower = prompt_text.lower()
    patterns = [
        r'out of syllabus',
        r'outside syllabus',
        r'out-of-syllabus',
        r'not in syllabus',
        r'any topic',
        r'outside the syllabus',
        r'fine to give out of syllabus',
        r'allowed to give out of syllabus',
        r'can be out of syllabus',
        r'fine if out of syllabus',
        r'allow out of syllabus',
        r'fine that u can give topic ou of syllabus',
        r'allowed to give qs out of syllabus',
    ]
    return any(re.search(p, prompt_lower) for p in patterns)


def is_subject_only_query(prompt_text, subjects):
    """Check if the prompt is essentially just naming a subject (e.g. 'Software Engineering', 'SE', 'DSA', 'Operating Systems')."""
    clean = prompt_text.lower().strip()
    clean = re.sub(r'\b(quiz|questions|question|test|exam|for|on|in|mcq|mcqs|give|me|create|generate|practice)\b', '', clean).strip()
    for s in subjects:
        if clean == s.lower():
            return True
        for alias, target in SUBJECT_ALIASES.items():
            if target == s and clean == alias.lower():
                return True
    return False


def find_syllabus_context(prompt_text):
    """
    Find relevant syllabus topics matching the prompt via ChromaDB similarity check and syllabus parsing.
    Returns:
      {
        "is_matched": bool,
        "out_of_syllabus_permitted": bool,
        "mode": "full_subject" | "single_subject_topics" | "topic_union" | "out_of_syllabus",
        "subjects": [str, ...],
        "syllabus_matches": [...],
        "context_text": str,
        "badge": str
      }
    """
    explicit_subjects = detect_subjects_in_prompt(prompt_text)
    out_of_syllabus_permitted = check_out_of_syllabus_permitted(prompt_text)

    # 1. Subject-only prompt (e.g. "software engineering", "SE", "DSA")
    if explicit_subjects and is_subject_only_query(prompt_text, explicit_subjects):
        results = []
        context_blocks = []
        for sname in explicit_subjects:
            struct = parse_syllabus_structure(sname)
            units = struct.get("units", [])
            results.append({
                "subject": sname,
                "scope": "full_subject",
                "units": units
            })
            unit_strs = []
            for u in units:
                topics_str = ", ".join(u.get("topics", []))
                unit_strs.append(f"  * {u.get('unit', '')} ({u.get('title', '')}): {topics_str}")
            context_blocks.append(f"Subject: {sname} (Full Syllabus)\n" + "\n".join(unit_strs))

        context_text = "\n\n".join(context_blocks)
        subject_title = ", ".join(explicit_subjects)
        return {
            "is_matched": True,
            "out_of_syllabus_permitted": out_of_syllabus_permitted,
            "mode": "full_subject",
            "subjects": explicit_subjects,
            "syllabus_matches": results,
            "context_text": context_text,
            "badge": f"Syllabus: {subject_title} (Full Course)"
        }

    # 2. ChromaDB Similarity Check
    try:
        embedder = get_embedder()
        emb = embedder.encode(prompt_text).tolist()
    except Exception as e:
        logger.warning(f"Failed to compute query embedding: {e}")
        emb = [0.0] * 384

    # Build filter if explicit subjects were mentioned
    where_pyq = None
    where_syl = None
    if explicit_subjects:
        if len(explicit_subjects) == 1:
            where_pyq = {"$and": [{"subject": explicit_subjects[0]}, {"doc_type": "pyq"}]}
            where_syl = {"$and": [{"subject": explicit_subjects[0]}, {"doc_type": "syllabus"}]}
        else:
            where_pyq = {"$and": [{"subject": {"$in": explicit_subjects}}, {"doc_type": "pyq"}]}
            where_syl = {"$and": [{"subject": {"$in": explicit_subjects}}, {"doc_type": "syllabus"}]}
    else:
        where_pyq = {"doc_type": "pyq"}
        where_syl = {"doc_type": "syllabus"}

    pyq_res = {"documents": [[]], "metadatas": [[]], "distances": [[]]}
    syl_res = {"documents": [[]], "metadatas": [[]], "distances": [[]]}

    try:
        pyq_res = collection.query(
            query_embeddings=[emb],
            n_results=10,
            where=where_pyq
        )
    except Exception as e:
        logger.warning(f"ChromaDB PYQ query failed: {e}")

    try:
        syl_res = collection.query(
            query_embeddings=[emb],
            n_results=4,
            where=where_syl
        )
    except Exception as e:
        logger.warning(f"ChromaDB Syllabus query failed: {e}")

    candidate_subjects = set(explicit_subjects)

    # Syllabus document similarity match (threshold < 1.35)
    if syl_res.get("metadatas") and syl_res["metadatas"][0]:
        for meta, dist in zip(syl_res["metadatas"][0], syl_res["distances"][0]):
            if dist < 1.35:
                candidate_subjects.add(meta.get("subject"))

    # PYQ chunks similarity match (threshold < 1.15)
    subject_topics = {}
    if pyq_res.get("metadatas") and pyq_res["metadatas"][0]:
        for meta, dist in zip(pyq_res["metadatas"][0], pyq_res["distances"][0]):
            sname = meta.get("subject")
            unit = meta.get("unit")
            topic = meta.get("topic")
            if explicit_subjects and sname not in explicit_subjects:
                continue
            if dist < 1.15 and topic and topic != "Unclassified":
                candidate_subjects.add(sname)
                if sname not in subject_topics:
                    subject_topics[sname] = set()
                subject_topics[sname].add((unit, topic))

    # Keyword matching against syllabus structures of candidate subjects
    keywords = [
        w.lower() for w in re.findall(r'\b[a-zA-Z]{3,}\b', prompt_text)
        if w.lower() not in STOPWORDS and w.lower() not in [s.lower() for s in explicit_subjects]
    ]

    for sname in candidate_subjects:
        try:
            struct = parse_syllabus_structure(sname)
            for u in struct.get("units", []):
                unit_label = u.get("unit", "")
                for t in u.get("topics", []):
                    t_lower = t.lower()
                    if keywords and any(k in t_lower for k in keywords):
                        if sname not in subject_topics:
                            subject_topics[sname] = set()
                        subject_topics[sname].add((unit_label, t))
        except Exception as e:
            logger.warning(f"Error parsing syllabus structure for {sname}: {e}")

    # Fallback to full syllabus if explicit subject provided but no specific subtopics matched
    if not subject_topics and explicit_subjects:
        results = []
        context_blocks = []
        for sname in explicit_subjects:
            struct = parse_syllabus_structure(sname)
            units = struct.get("units", [])
            results.append({
                "subject": sname,
                "scope": "full_subject",
                "units": units
            })
            unit_strs = []
            for u in units:
                topics_str = ", ".join(u.get("topics", []))
                unit_strs.append(f"  * {u.get('unit', '')} ({u.get('title', '')}): {topics_str}")
            context_blocks.append(f"Subject: {sname} (Full Syllabus)\n" + "\n".join(unit_strs))

        return {
            "is_matched": True,
            "out_of_syllabus_permitted": out_of_syllabus_permitted,
            "mode": "full_subject",
            "subjects": explicit_subjects,
            "syllabus_matches": results,
            "context_text": "\n\n".join(context_blocks),
            "badge": f"Syllabus: {', '.join(explicit_subjects)}"
        }

    # If no topics or candidate subjects found
    if not subject_topics:
        return {
            "is_matched": False,
            "out_of_syllabus_permitted": out_of_syllabus_permitted,
            "mode": "out_of_syllabus",
            "subjects": [],
            "syllabus_matches": [],
            "context_text": "No matching syllabus topics found in the course database.",
            "badge": "Out of Syllabus Topic"
        }

    # Format syllabus topics union
    syllabus_matches = []
    context_blocks = []
    for sname, topic_set in subject_topics.items():
        sorted_topics = sorted([{"unit": u, "topic": t} for u, t in topic_set], key=lambda x: (x["unit"], x["topic"]))
        syllabus_matches.append({
            "subject": sname,
            "topics": sorted_topics
        })
        lines = [f"Subject: {sname}"]
        for item in sorted_topics:
            lines.append(f"  - [{item['unit']}] {item['topic']}")
        context_blocks.append("\n".join(lines))

    context_text = "\n\n".join(context_blocks)
    subjects_list = list(subject_topics.keys())
    mode = "topic_union" if len(subjects_list) > 1 else "single_subject_topics"

    if mode == "topic_union":
        badge = f"Syllabus Union: {' & '.join(subjects_list)}"
    else:
        badge = f"Syllabus: {subjects_list[0]}"

    return {
        "is_matched": True,
        "out_of_syllabus_permitted": out_of_syllabus_permitted,
        "mode": mode,
        "subjects": subjects_list,
        "syllabus_matches": syllabus_matches,
        "context_text": context_text,
        "badge": badge
    }


def build_quiz_prompt(topic_description, num_questions, syllabus_info):
    """Constructs a strict syllabus-grounded prompt for Gemini."""
    is_matched = syllabus_info["is_matched"]
    mode = syllabus_info["mode"]
    subjects = syllabus_info["subjects"]
    out_of_syllabus_permitted = syllabus_info["out_of_syllabus_permitted"]
    context_text = syllabus_info["context_text"]

    instructions = []

    if is_matched:
        if mode == "full_subject":
            instructions.append(f"""SYLLABUS GROUNDING:
The user prompt references the college course: {', '.join(subjects)}.
Below is the official course syllabus structure:
---
{context_text}
---
CRITICAL RULES:
- All questions MUST be strictly based on and cover topics present in this subject's syllabus.
- Distribute questions across the syllabus units/topics.
- Do NOT include questions on tools, topics, or technologies outside this course syllabus.""")
        elif mode in ("single_subject_topics", "topic_union"):
            if mode == "topic_union":
                subj_desc = f"the union of relevant syllabus areas across matching subjects: {', '.join(subjects)}"
            else:
                subj_desc = f"the course syllabus for: {subjects[0]}"

            instructions.append(f"""SYLLABUS GROUNDING (UNION OF MATCHING TOPICS):
The user prompt matches {subj_desc}.
Below are the exact relevant syllabus topics found in the course database:
---
{context_text}
---
CRITICAL RULES:
- The quiz MUST be strictly based on the syllabus topics listed above.
- You MUST NOT include questions on algorithms, methods, or concepts that are outside the listed syllabus topics. (For example, if the syllabus lists Selection, Bubble, Insertion, Merge, Heap, Quick, Radix sort, do NOT ask about Timsort, Shell sort, or unrelated algorithms not in this syllabus).
- If the user prompt specifically named a subject (e.g. 'sorting in dsa'), the quiz is scoped exclusively to that subject's syllabus topics above.""")

        if out_of_syllabus_permitted:
            instructions.append("""OUT-OF-SYLLABUS PERMISSION:
The user prompt explicitly noted that out-of-syllabus topics are permitted. You may include broader relevant concepts if appropriate.""")
    else:
        instructions.append(f"""OUT-OF-SYLLABUS TOPIC:
The requested topic '{topic_description}' was not found in the ingested college syllabus.
CRITICAL RULES:
- As the topic is outside the college syllabus, you are permitted to generate a comprehensive, high-quality multiple-choice quiz covering the topic generally.
- Ensure questions are educational, varied in difficulty, and have accurate explanations.""")

    rules_block = "\n\n".join(instructions)

    prompt = f"""You are an expert exam quiz generation engine for college engineering students.
Output ONLY valid JSON. No markdown fences, no preamble, no commentary, no trailing text.

{rules_block}

General Rules:
- Produce exactly {num_questions} questions, unless the topic description explicitly states a different number (e.g. "15 qs on X").
- Each question has exactly 4 options with ids "a", "b", "c", "d".
- Exactly one option is correct per question.
- Vary difficulty across questions; avoid duplicate or near-duplicate questions.
- Write a short, clear explanation (1-3 sentences) for why the correct answer is correct and why other options are incorrect.
- Keep question text and options concise and clear.

Output strictly in this JSON shape:
{{
  "title": "Short descriptive quiz title",
  "num_questions": {num_questions},
  "questions": [
    {{
      "id": 1,
      "question": "Question text",
      "options": [
        {{"id": "a", "text": "Option A text"}},
        {{"id": "b", "text": "Option B text"}},
        {{"id": "c", "text": "Option C text"}},
        {{"id": "d", "text": "Option D text"}}
      ],
      "correct_option_id": "b",
      "explanation": "Why b is correct, and briefly why the others are not."
    }}
  ]
}}

User Topic Request:
\"\"\"{topic_description.strip()}\"\"\"
"""
    return prompt


def _validate_quiz(data, expected_num_questions):
    if not isinstance(data, dict) or "questions" not in data or not isinstance(data["questions"], list):
        raise QuizGenerationError("Malformed quiz: missing 'questions' list.")

    if len(data["questions"]) == 0:
        raise QuizGenerationError("Malformed quiz: zero questions returned.")

    for i, q in enumerate(data["questions"]):
        required_keys = {"id", "question", "options", "correct_option_id", "explanation"}
        if not required_keys.issubset(q.keys()):
            raise QuizGenerationError(f"Question {i} missing required fields.")
        if len(q["options"]) < 2:
            raise QuizGenerationError(f"Question {i} has fewer than 2 options.")
        option_ids = {opt["id"] for opt in q["options"]}
        if q["correct_option_id"] not in option_ids:
            raise QuizGenerationError(f"Question {i}: correct_option_id not among options.")

    data.setdefault("title", "Generated Quiz")
    data["num_questions"] = len(data["questions"])
    return data


def generate_quiz(topic_description, num_questions=10):
    """
    Generate a validated quiz grounded in the course syllabus via ChromaDB similarity.
    Returns:
    {
      "title": str,
      "num_questions": int,
      "syllabus_info": { ... },
      "questions": [ ... ]
    }
    Raises QuizGenerationError on failure.
    """
    if not topic_description or not topic_description.strip():
        raise QuizGenerationError("Topic description is required.")

    # 1. Similarity check with ChromaDB & Syllabus resolution
    syllabus_info = find_syllabus_context(topic_description.strip())

    # 2. Build syllabus-grounded prompt
    prompt = build_quiz_prompt(topic_description, num_questions, syllabus_info)

    # 3. Call Gemini
    try:
        parsed = call_gemini_json(prompt)
    except Exception as e:
        logger.exception("Gemini call failed during quiz generation")
        raise QuizGenerationError(f"AI call failed: {e}")

    # 4. Validate output
    validated = _validate_quiz(parsed, num_questions)

    # 5. Attach syllabus metadata
    validated["syllabus_info"] = {
        "is_matched": syllabus_info["is_matched"],
        "mode": syllabus_info["mode"],
        "subjects": syllabus_info["subjects"],
        "out_of_syllabus_permitted": syllabus_info["out_of_syllabus_permitted"],
        "badge": syllabus_info.get("badge", ""),
    }

    return validated
