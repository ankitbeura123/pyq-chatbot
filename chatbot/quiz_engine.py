import logging
from .gemini_utils import call_gemini_json

logger = logging.getLogger(__name__)


QUIZ_PROMPT_TEMPLATE = """You are a quiz-generation engine for a student exam-prep tool.
Output ONLY valid JSON. No markdown fences, no preamble, no commentary, no trailing text.

Generate a multiple-choice quiz based on the topic description below.

Rules:
- Produce exactly {num_questions} questions, unless the topic description itself explicitly
  states a different number of questions (e.g. "15 qs on X") — in that case honor the number
  stated in the description instead.
- Each question has exactly 4 options.
- Exactly one option is correct per question.
- Vary difficulty and phrasing across questions; avoid near-duplicates.
- Write a short, clear explanation (1-3 sentences) for why the correct answer is correct.
- Keep question text and options concise.

Output strictly in this JSON shape (a single JSON object, nothing else):

{{
  "title": "Short quiz title derived from the topic",
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

Topic description from the user:
\"\"\"{topic_description}\"\"\"
"""


class QuizGenerationError(Exception):
    pass


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
    Generate a validated quiz dict:
    {
      "title": str,
      "num_questions": int,
      "questions": [
        {"id", "question", "options": [{"id","text"}, ...], "correct_option_id", "explanation"}, ...
      ]
    }
    Raises QuizGenerationError on any failure.
    """
    if not topic_description or not topic_description.strip():
        raise QuizGenerationError("Topic description is required.")

    prompt = QUIZ_PROMPT_TEMPLATE.format(
        num_questions=num_questions,
        topic_description=topic_description.strip(),
    )

    try:
        parsed = call_gemini_json(prompt)
    except Exception as e:
        logger.exception("Gemini call failed during quiz generation")
        raise QuizGenerationError(f"AI call failed: {e}")

    return _validate_quiz(parsed, num_questions)
