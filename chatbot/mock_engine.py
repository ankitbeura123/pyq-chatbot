import os
import re
import uuid
import tempfile
import math
import logging

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from django.conf import settings

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image as RLImage,
    ListFlowable, ListItem, HRFlowable, Table, TableStyle, KeepTogether
)
from reportlab.pdfgen import canvas

from .gemini_utils import call_gemini_json
from .syllabus_parser import parse_syllabus_structure
from .rag import collection

logger = logging.getLogger(__name__)

MOCK_DIR = os.path.join(settings.BASE_DIR, "mock_papers")
os.makedirs(MOCK_DIR, exist_ok=True)


class MockExamGenerationError(Exception):
    pass


class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to dynamically compute and render total page count & footer."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_footer(num_pages)
            super().showPage()
        super().save()

    def draw_footer(self, page_count):
        self.saveState()
        self.setFont("Times-Roman", 9)
        self.setStrokeColor(colors.HexColor("#a0a0a0"))
        self.setLineWidth(0.5)
        # Footer line
        self.line(40, 36, A4[0] - 40, 36)
        # Footer text
        self.drawString(40, 24, "KIIT Deemed to be University  |  Mock Examination Portal")
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(A4[0] - 40, 24, page_text)
        self.restoreState()


def _sanitize_filename_part(text):
    text = re.sub(r"[^a-zA-Z0-9\- ]", "", text).strip()
    text = re.sub(r"\s+", "_", text)
    return text[:45] or "exam"


def _format_exam_text(text):
    """
    Format text for ReportLab paragraphs:
    - Escapes raw XML characters safely (&, <, >).
    - Converts inline LaTeX math ($...$) to clean, elegant academic typography.
    """
    if not text:
        return ""

    def _convert_inline_math(match):
        s = match.group(1).strip()
        s = s.replace(r"\times", " × ")
        s = s.replace(r"\cdot", " · ")
        s = s.replace(r"\div", " ÷ ")
        s = s.replace(r"\pm", " ± ")
        s = s.replace(r"\le", " ≤ ")
        s = s.replace(r"\leq", " ≤ ")
        s = s.replace(r"\ge", " ≥ ")
        s = s.replace(r"\geq", " ≥ ")
        s = s.replace(r"\neq", " ≠ ")
        s = s.replace(r"\approx", " ≈ ")
        s = s.replace(r"\infty", " ∞ ")
        s = s.replace(r"\rightarrow", " → ")
        s = s.replace(r"\to", " → ")
        s = s.replace(r"\leftarrow", " ← ")
        s = s.replace(r"\in", " ∈ ")
        s = s.replace(r"\notin", " ∉ ")
        s = s.replace(r"\subset", " ⊂ ")
        s = s.replace(r"\alpha", "α")
        s = s.replace(r"\beta", "β")
        s = s.replace(r"\gamma", "γ")
        s = s.replace(r"\theta", "θ")
        s = s.replace(r"\lambda", "λ")
        s = s.replace(r"\mu", "μ")
        s = s.replace(r"\sigma", "σ")
        s = s.replace(r"\omega", "ω")
        s = s.replace(r"\Omega", "Ω")
        s = s.replace(r"\Delta", "Δ")
        s = s.replace(r"\pi", "π")
        s = s.replace(r"\mathcal{O}", "O")
        s = s.replace(r"\text{O}", "O")
        s = s.replace(r"\binom", "C")
        s = re.sub(r"\^\{([^}]+)\}", r"<sup>\1</sup>", s)
        s = re.sub(r"\^([a-zA-Z0-9+\-]+)", r"<sup>\1</sup>", s)
        s = re.sub(r"_\{([^}]+)\}", r"<sub>\1</sub>", s)
        s = re.sub(r"_([a-zA-Z0-9+\-]+)", r"<sub>\1</sub>", s)
        s = re.sub(r"\\frac\{([^}]+)\}\{([^}]+)\}", r"(\1 / \2)", s)
        s = re.sub(r"\\[a-zA-Z]+", "", s)
        return f"<i>{s}</i>"

    clean = str(text)
    clean = clean.replace("&", "&amp;")
    clean = clean.replace("<", "&lt;").replace(">", "&gt;")

    # Decode escaped tags back for safe allowed tags
    clean = re.sub(r"\$([^$]+)\$", _convert_inline_math, clean)

    # General replacements for bare LaTeX symbols outside $
    clean = clean.replace(r"\times", "×")
    clean = clean.replace(r"\le", "≤")
    clean = clean.replace(r"\ge", "≥")
    clean = clean.replace(r"\neq", "≠")
    clean = clean.replace(r"\rightarrow", "→")

    return clean


def _render_formula_image(latex_str, out_path, fontsize=10.5, dpi=200):
    """
    Render a single LaTeX formula string to a transparent PNG via matplotlib mathtext.
    Returns: (out_path, width_pt, height_pt) with true scaled dimensions for ReportLab.
    """
    clean_latex = str(latex_str).strip().strip("$").strip()
    if not clean_latex:
        raise ValueError("Empty formula string")

    fig = plt.figure(figsize=(0.1, 0.1))
    try:
        text_obj = fig.text(0, 0, f"${clean_latex}$", fontsize=fontsize, color="#111827")
        fig.canvas.draw()
        bbox = text_obj.get_window_extent()
        width_in = bbox.width / fig.dpi + 0.05
        height_in = bbox.height / fig.dpi + 0.05
        fig.set_size_inches(width_in, height_in)
        text_obj.set_position((0.02, 0.1))
        fig.savefig(out_path, dpi=dpi, transparent=True, bbox_inches="tight", pad_inches=0.02)

        from PIL import Image
        with Image.open(out_path) as img:
            px_w, px_h = img.size

        # Convert pixels to points (1 in = 72 pt)
        pt_w = px_w * (72.0 / dpi)
        pt_h = px_h * (72.0 / dpi)

        # Restrict max width and keep proportional
        max_w = 380.0
        if pt_w > max_w:
            scale = max_w / pt_w
            pt_w = max_w
            pt_h = pt_h * scale

        return out_path, pt_w, pt_h
    finally:
        plt.close(fig)


def get_exam_syllabus_scope(subject_name, exam_type):
    """
    Returns the units and topics matching the exam scope:
    - Midsem: First half of syllabus (e.g. 3 of 6 units, or 2.5 of 5 units).
    - Endsem: Complete syllabus (all units).
    """
    struct = parse_syllabus_structure(subject_name)
    all_units = struct.get("units", [])
    if not all_units:
        return {"scope_label": "Entire Course", "units": [], "is_partial": False}

    norm_type = exam_type.lower()
    if "mid" in norm_type:
        n = len(all_units)
        # Halving logic: e.g. 6 units -> 3 units; 5 units -> 2 full units + 1/2 of unit 3
        half_count = n / 2.0
        selected_units = []
        for i, u in enumerate(all_units):
            if i + 1 <= math.floor(half_count):
                selected_units.append(u)
            elif i + 1 == math.ceil(half_count) and (n % 2 != 0):
                # Half of unit
                topics = u.get("topics", [])
                half_topics_cnt = max(1, math.ceil(len(topics) / 2))
                selected_units.append({
                    "unit": u.get("unit", f"Unit {i+1}"),
                    "title": f"{u.get('title', '')} (First Half)",
                    "topics": topics[:half_topics_cnt]
                })
                break
            elif i + 1 > math.ceil(half_count):
                break

        return {
            "scope_label": f"Mid-Semester Scope (First {len(selected_units)} Units / Half Syllabus)",
            "units": selected_units,
            "is_partial": True,
            "total_units_in_subject": n,
        }
    else:
        return {
            "scope_label": f"End-Semester Scope (All {len(all_units)} Units)",
            "units": all_units,
            "is_partial": False,
            "total_units_in_subject": len(all_units),
        }


def _retrieve_pyq_samples(subject_name, exam_type, limit=8):
    """Retrieve actual past exam question samples to ground the style and standard."""
    try:
        norm_exam = "Midsem" if "mid" in exam_type.lower() else "Endsem"
        results = collection.get(
            where={"$and": [{"subject": subject_name}, {"doc_type": "pyq"}]},
            limit=limit
        )
        docs = results.get("documents", [])
        metas = results.get("metadatas", [])
        samples = []
        for doc, meta in zip(docs, metas):
            qnum = meta.get("question_number", "")
            year = meta.get("year", "")
            samples.append(f"[{year} Q{qnum}]: {doc[:200]}")
        return "\n".join(samples)
    except Exception as e:
        logger.warning(f"Error fetching PYQ samples: {e}")
        return ""


def build_exam_generation_prompt(subject_name, exam_type, semester, syllabus_scope, pyq_samples):
    norm_type = "Midsem" if "mid" in exam_type.lower() else "Endsem"
    units_text = []
    for u in syllabus_scope["units"]:
        topics = ", ".join(u.get("topics", []))
        units_text.append(f"• {u.get('unit', '')} ({u.get('title', '')}): {topics}")
    syllabus_str = "\n".join(units_text)

    if norm_type == "Midsem":
        blueprint_instructions = """
BLUEPRINT SPECIFICATIONS FOR MIDSEM EXAMINATION (Total Marks: 20 | Time: 1.5 Hours):
1. **Syllabus Coverage**: Questions MUST ONLY be drawn from the provided half-syllabus units. Do NOT test subsequent units.
2. **Question Structure**:
   - **Question 1 (Compulsory)**: Exactly 5 one-mark sub-questions: 1(a), 1(b), 1(c), 1(d), 1(e).
     - Each sub-question is worth 1 mark (Total: 5 Marks).
     - Short conceptual questions, definitions, quick formula applications, or one-line calculations.
   - **Questions 2, 3, 4, 5 (Long Questions - Answer any THREE)**:
     - Exactly 4 long questions: Q.2, Q.3, Q.4, Q.5 (3 required + 1 extra choice question).
     - Each question has sub-parts e.g. (a) and (b) such that the sum of marks for each question is EXACTLY 5 MARKS (e.g. (a) [2.5] + (b) [2.5] = 5, or (a) [3] + (b) [2] = 5, or a comprehensive [5] mark question).
     - Total Marks achievable: Q1 (5 marks) + Any 3 from (Q2-Q5, 3 × 5 = 15 marks) = **20 Marks**.
"""
        json_example = """{
  "exam_title": "MID SEMESTER EXAMINATION",
  "subject_name": "...",
  "semester": "...",
  "time_allowed": "1.5 Hours",
  "full_marks": 20,
  "instructions": "Answer Question No. 1 (Compulsory) and any THREE from Question No. 2 to 5. Figures in brackets indicate marks.",
  "section_a": {
    "title": "SECTION - A (Compulsory)",
    "total_marks": 5,
    "questions": [
      {
        "id": "1(a)",
        "question_text": "Define ...",
        "marks": 1,
        "topic": "...",
        "formula": "",
        "solution": {
          "steps": ["Step 1 explanation / definition", "Final summary"],
          "final_answer": "Concise direct answer",
          "marking_scheme": "[1 Mark] for correct definition and key terms"
        }
      }
    ]
  },
  "section_b": {
    "title": "SECTION - B (Answer any THREE)",
    "instruction": "Answer any THREE questions from Q.2 to Q.5. Each question carries 5 marks.",
    "questions": [
      {
        "question_number": 2,
        "total_marks": 5,
        "sub_parts": [
          {
            "part": "(a)",
            "question_text": "...",
            "marks": 2.5,
            "formula": "\\\\frac{dy}{dx} + P(x)y = Q(x)",
            "solution": {
              "steps": ["Step-by-step derivation/working", "Intermediate step"],
              "final_answer": "...",
              "marking_scheme": "[1 Mark] for integrating factor, [1.5 Marks] for general solution"
            }
          },
          {
            "part": "(b)",
            "question_text": "...",
            "marks": 2.5,
            "formula": "",
            "solution": {
              "steps": ["Step 1", "Step 2"],
              "final_answer": "...",
              "marking_scheme": "[1 Mark] for setup, [1.5 Marks] for calculation"
            }
          }
        ]
      }
    ]
  }
}"""
    else:  # Endsem
        blueprint_instructions = """
BLUEPRINT SPECIFICATIONS FOR ENDSEM EXAMINATION (Total Marks: 50 | Time: 3.0 Hours):
1. **Syllabus Coverage**: Questions MUST span across the entire course syllabus (all units) in balanced proportion.
2. **Question Structure**:
   - **Question 1 (Compulsory)**: Exactly 10 one-mark sub-questions: 1(a) to 1(j).
     - Each sub-question is worth 1 mark (Total: 10 Marks).
     - Conceptual, definitions, properties, short reasoning, or brief formula computations.
   - **Questions 2, 3, 4, 5, 6, 7 (Long Questions - Answer any FOUR)**:
     - Exactly 6 long questions: Q.2, Q.3, Q.4, Q.5, Q.6, Q.7 (4 required + 2 extra choice questions).
     - Each question has sub-parts (e.g. (a) and (b), or (a), (b), (c)) such that the sum of marks for each question is EXACTLY 10 MARKS (e.g. (a) [5] + (b) [5] = 10, or (a) [4] + (b) [6] = 10, or (a) [3] + (b) [3] + (c) [4] = 10).
     - Total Marks achievable: Q1 (10 marks) + Any 4 from (Q2-Q7, 4 × 10 = 40 marks) = **50 Marks**.
"""
        json_example = """{
  "exam_title": "END SEMESTER EXAMINATION",
  "subject_name": "...",
  "semester": "...",
  "time_allowed": "3.0 Hours",
  "full_marks": 50,
  "instructions": "Answer Question No. 1 (Compulsory) and any FOUR from Question No. 2 to 7. Figures in brackets indicate marks.",
  "section_a": {
    "title": "SECTION - A (Compulsory)",
    "total_marks": 10,
    "questions": [
      {
        "id": "1(a)",
        "question_text": "...",
        "marks": 1,
        "topic": "...",
        "formula": "",
        "solution": {
          "steps": ["Step 1", "Step 2"],
          "final_answer": "...",
          "marking_scheme": "[1 Mark] for correct explanation"
        }
      }
    ]
  },
  "section_b": {
    "title": "SECTION - B (Answer any FOUR)",
    "instruction": "Answer any FOUR questions from Q.2 to Q.7. Each question carries 10 marks.",
    "questions": [
      {
        "question_number": 2,
        "total_marks": 10,
        "sub_parts": [
          {
            "part": "(a)",
            "question_text": "...",
            "marks": 5,
            "formula": "",
            "solution": {
              "steps": ["Step 1: Formula definition", "Step 2: Substitution & solving", "Step 3: Verification"],
              "final_answer": "...",
              "marking_scheme": "[2 Marks] for derivation, [3 Marks] for numerical solution"
            }
          },
          {
            "part": "(b)",
            "question_text": "...",
            "marks": 5,
            "formula": "",
            "solution": {
              "steps": ["Step 1", "Step 2"],
              "final_answer": "...",
              "marking_scheme": "[2 Marks] for theory, [3 Marks] for diagram/working"
            }
          }
        ]
      }
    ]
  }
}"""

    prompt = f"""You are the Chief Examination Controller and Senior Professor at KIIT University designing an authentic, high-quality university {norm_type} Examination Question Paper and comprehensive Solution Key for the course: "{subject_name}" ({semester or 'B.Tech'}).

COURSE SYLLABUS SCOPE:
---
{syllabus_str}
---

PAST QUESTION EXAMPLES / STYLE REFERENCE (GROUNDING):
---
{pyq_samples or "Standard rigorous university engineering questions"}
---

{blueprint_instructions}

CRITICAL RULES:
1. **Mathematical / Scientific Formulas**: Format all mathematical formulas, equations, integrals, matrices, and notation using valid LaTeX syntax (e.g. `\\\\int_0^\\\\infty e^{{-x^2}} dx`, `\\\\frac{{d^2y}}{{dx^2}} + \\\\omega^2 y = 0`, `\\\\sum_{{i=1}}^n i^2`).
2. **JSON Escaping**: Every single backslash in LaTeX strings MUST be double escaped (`\\\\frac`, `\\\\sqrt`, `\\\\alpha`, `\\\\beta`, `\\\\lambda`, `\\\\in`, `\\\\le`, etc.) so that the output is 100% valid JSON.
3. **Rigorous Solutions & Marking Scheme**:
   - For every question and sub-part, provide a complete, step-by-step solution.
   - Include a clear step-wise marking rubric in `marking_scheme` (e.g., "[1 Mark] for theorem statement, [2 Marks] for substitution, [2 Marks] for final answer with units").
4. **Exact Mark Allocations**:
   - For Midsem: Q1 has 5 × 1m = 5m. Q2, Q3, Q4, Q5 each have sub-parts summing strictly to 5 marks.
   - For Endsem: Q1 has 10 × 1m = 10m. Q2, Q3, Q4, Q5, Q6, Q7 each have sub-parts summing strictly to 10 marks.
5. **Output Format**: Respond ONLY with a single valid JSON object matching this schema without markdown codeblocks or preamble:

{json_example}
"""
    return prompt


def _validate_mock_data(data, exam_type):
    """Ensure mock exam data strictly adheres to mark rules and question counts."""
    if not isinstance(data, dict):
        raise MockExamGenerationError("Generated mock paper data is not a valid JSON object.")

    norm_type = "Midsem" if "mid" in exam_type.lower() else "Endsem"
    sec_a = data.get("section_a", {})
    sec_b = data.get("section_b", {})
    q1_list = sec_a.get("questions", [])
    long_list = sec_b.get("questions", [])

    if norm_type == "Midsem":
        if len(q1_list) < 5:
            raise MockExamGenerationError(f"Midsem Section A requires 5 one-mark questions, got {len(q1_list)}.")
        if len(long_list) < 4:
            raise MockExamGenerationError(f"Midsem Section B requires 4 long questions (Q2-Q5), got {len(long_list)}.")
        data["full_marks"] = 20
        data["time_allowed"] = data.get("time_allowed", "1.5 Hours")
    else:
        if len(q1_list) < 10:
            raise MockExamGenerationError(f"Endsem Section A requires 10 one-mark questions, got {len(q1_list)}.")
        if len(long_list) < 6:
            raise MockExamGenerationError(f"Endsem Section B requires 6 long questions (Q2-Q7), got {len(long_list)}.")
        data["full_marks"] = 50
        data["time_allowed"] = data.get("time_allowed", "3.0 Hours")

    return data


def generate_mock_exam(subject_name, exam_type, semester=None):
    """
    Generates a structured mock paper + solution key grounded in syllabus and PYQ patterns.
    """
    syllabus_scope = get_exam_syllabus_scope(subject_name, exam_type)
    pyq_samples = _retrieve_pyq_samples(subject_name, exam_type)

    prompt = build_exam_generation_prompt(
        subject_name=subject_name,
        exam_type=exam_type,
        semester=semester,
        syllabus_scope=syllabus_scope,
        pyq_samples=pyq_samples
    )

    try:
        raw_data = call_gemini_json(prompt)
    except Exception as e:
        logger.exception("Gemini call failed during mock exam generation")
        raise MockExamGenerationError(f"AI generation failed: {e}")

    validated_data = _validate_mock_data(raw_data, exam_type)
    validated_data["syllabus_scope"] = syllabus_scope
    return validated_data


def build_exam_pdf(paper_data, is_solution=False):
    """
    Builds a university-standard examination PDF using ReportLab + Matplotlib LaTeX rendering.
    is_solution=False -> Question Paper PDF
    is_solution=True  -> Complete Answer Key & Step-by-Step Marking Scheme PDF
    """
    exam_id = uuid.uuid4().hex[:10]
    subject = paper_data.get("subject_name", "Subject")
    prefix = "mock_ans" if is_solution else "mock_qp"
    filename = f"{prefix}_{_sanitize_filename_part(subject)}_{exam_id}.pdf"
    out_path = os.path.join(MOCK_DIR, filename)

    with tempfile.TemporaryDirectory() as tmp_dir:
        styles = getSampleStyleSheet()

        # Styles definition
        univ_header_style = ParagraphStyle(
            "UnivHeader", parent=styles["Normal"],
            fontName="Times-Bold", fontSize=13.5, leading=17,
            alignment=1, textColor=colors.HexColor("#111827")
        )
        univ_sub_style = ParagraphStyle(
            "UnivSub", parent=styles["Normal"],
            fontName="Times-Roman", fontSize=9.5, leading=13,
            alignment=1, textColor=colors.HexColor("#374151")
        )
        exam_title_style = ParagraphStyle(
            "ExamTitle", parent=styles["Normal"],
            fontName="Times-Bold", fontSize=11.5, leading=15,
            alignment=1, textColor=colors.HexColor("#111827"),
            spaceBefore=4, spaceAfter=4
        )
        meta_table_style = ParagraphStyle(
            "MetaText", parent=styles["Normal"],
            fontName="Times-Bold", fontSize=9.5, leading=13,
            textColor=colors.HexColor("#1f2937")
        )
        meta_table_val_style = ParagraphStyle(
            "MetaValText", parent=styles["Normal"],
            fontName="Times-Roman", fontSize=9.5, leading=13,
            textColor=colors.HexColor("#1f2937")
        )
        instructions_style = ParagraphStyle(
            "Instructions", parent=styles["Italic"],
            fontName="Times-Italic", fontSize=9, leading=13,
            alignment=0, textColor=colors.HexColor("#374151"),
            spaceBefore=3, spaceAfter=5
        )
        section_heading_style = ParagraphStyle(
            "SecHeading", parent=styles["Normal"],
            fontName="Times-Bold", fontSize=10.5, leading=14,
            alignment=1, textColor=colors.HexColor("#111827"),
            spaceBefore=10, spaceAfter=6
        )
        q_text_style = ParagraphStyle(
            "QText", parent=styles["Normal"],
            fontName="Times-Roman", fontSize=10, leading=14,
            textColor=colors.HexColor("#111827")
        )
        marks_style = ParagraphStyle(
            "Marks", parent=styles["Normal"],
            fontName="Times-Bold", fontSize=9.5, leading=13,
            alignment=2, textColor=colors.HexColor("#1f2937")
        )
        sol_step_style = ParagraphStyle(
            "SolStep", parent=styles["Normal"],
            fontName="Times-Roman", fontSize=9.5, leading=13.5,
            textColor=colors.HexColor("#1f2937")
        )
        sol_header_style = ParagraphStyle(
            "SolHeader", parent=styles["Normal"],
            fontName="Times-Bold", fontSize=9.5, leading=13,
            textColor=colors.HexColor("#1e3a8a"), spaceBefore=4, spaceAfter=2
        )
        rubric_style = ParagraphStyle(
            "Rubric", parent=styles["Normal"],
            fontName="Times-Italic", fontSize=8.8, leading=12,
            textColor=colors.HexColor("#065f46"), spaceBefore=3
        )

        story = []

        # --- UNIVERSITY HEADER ---
        story.append(Paragraph("KALINGA INSTITUTE OF INDUSTRIAL TECHNOLOGY", univ_header_style))
        story.append(Paragraph("Deemed to be University, Bhubaneswar - 751024, Odisha", univ_sub_style))
        
        doc_type_label = "SOLUTIONS & MARKING SCHEME" if is_solution else "EXAMINATION QUESTION PAPER"
        exam_title = f"{paper_data.get('exam_title', 'SEMESTER EXAMINATION')} — {doc_type_label}"
        story.append(Paragraph(exam_title, exam_title_style))

        # Horizontal Double Line
        story.append(HRFlowable(width="100%", thickness=1.2, color=colors.HexColor("#111827"), spaceBefore=3, spaceAfter=2))

        # Subject, Semester, Time, Full Marks Table
        subject_name = paper_data.get("subject_name", subject)
        semester = paper_data.get("semester", "B.Tech")
        time_allowed = paper_data.get("time_allowed", "3 Hours")
        full_marks = paper_data.get("full_marks", 50)

        meta_rows = [
            [
                Paragraph(f"<b>Subject:</b> {subject_name}", meta_table_style),
                Paragraph(f"<b>Time:</b> {time_allowed}", meta_table_style)
            ],
            [
                Paragraph(f"<b>Semester / Programme:</b> {semester}", meta_table_val_style),
                Paragraph(f"<b>Full Marks:</b> {full_marks}", meta_table_style)
            ]
        ]
        meta_table = Table(meta_rows, colWidths=[4.2 * inch, 2.8 * inch])
        meta_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(meta_table)

        story.append(HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#4b5563"), spaceBefore=3, spaceAfter=4))

        # Instructions
        instructions = paper_data.get("instructions", "Answer Question No. 1 and specified questions from the rest. Figures in brackets indicate marks.")
        story.append(Paragraph(f"<i><b>Instructions:</b> {instructions}</i>", instructions_style))
        story.append(HRFlowable(width="100%", thickness=0.4, color=colors.HexColor("#9ca3af"), spaceBefore=2, spaceAfter=6))

        # --- SECTION A: ONE-MARK COMPULSORY QUESTIONS ---
        sec_a = paper_data.get("section_a", {})
        sec_a_title = sec_a.get("title", "SECTION - A (Compulsory)")
        story.append(Paragraph(f"<b>{sec_a_title}</b>", section_heading_style))

        q1_elements = []
        for q_idx, q in enumerate(sec_a.get("questions", [])):
            qid = q.get("id", f"1({chr(97+q_idx)})")
            qtext = _format_exam_text(q.get("question_text", ""))
            qmarks = q.get("marks", 1)
            formula = q.get("formula", "")

            # Row layout: [Question text + formula] [Marks]
            q_flowables = [Paragraph(f"<b>{qid}</b> {qtext}", q_text_style)]
            if formula:
                f_path = os.path.join(tmp_dir, f"sec_a_f_{q_idx}.png")
                try:
                    res = _render_formula_image(formula, f_path)
                    if res:
                        img_path, pt_w, pt_h = res
                        q_flowables.append(Spacer(1, 2))
                        q_flowables.append(RLImage(img_path, width=pt_w, height=pt_h, hAlign="LEFT"))
                        q_flowables.append(Spacer(1, 2))
                except Exception:
                    clean_f = _format_exam_text(formula)
                    q_flowables.append(Paragraph(f"<i>Formula: {clean_f}</i>", q_text_style))

            if is_solution and q.get("solution"):
                sol = q["solution"]
                sol_flows = [Spacer(1, 3), Paragraph("<b>Solution & Key Concept:</b>", sol_header_style)]
                for step in sol.get("steps", []):
                    sol_flows.append(Paragraph(f"• {_format_exam_text(step)}", sol_step_style))
                if sol.get("final_answer"):
                    sol_flows.append(Paragraph(f"<b>Answer:</b> {_format_exam_text(sol['final_answer'])}", sol_step_style))
                if sol.get("marking_scheme"):
                    sol_flows.append(Paragraph(f"<b>Marking Rubric:</b> {_format_exam_text(sol['marking_scheme'])}", rubric_style))
                q_flowables.extend(sol_flows)

            row = [
                q_flowables,
                Paragraph(f"[{qmarks}]", marks_style)
            ]
            q1_elements.append(row)

        if q1_elements:
            q1_table = Table(q1_elements, colWidths=[6.3 * inch, 0.7 * inch])
            q1_table.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor("#e5e7eb")),
            ]))
            story.append(q1_table)

        story.append(Spacer(1, 10))

        # --- SECTION B: LONG QUESTIONS ---
        sec_b = paper_data.get("section_b", {})
        sec_b_title = sec_b.get("title", "SECTION - B")
        story.append(Paragraph(f"<b>{sec_b_title}</b>", section_heading_style))
        if sec_b.get("instruction"):
            story.append(Paragraph(f"<i>{_format_exam_text(sec_b['instruction'])}</i>", instructions_style))
            story.append(Spacer(1, 4))

        for l_idx, lq in enumerate(sec_b.get("questions", [])):
            qnum = lq.get("question_number", l_idx + 2)
            total_lq_marks = lq.get("total_marks", 5 if paper_data.get("full_marks") == 20 else 10)

            lq_flows = []
            lq_header = Paragraph(f"<b>Q.{qnum}.</b>", ParagraphStyle("LQHead", parent=q_text_style, fontName="Times-Bold"))

            sub_parts = lq.get("sub_parts", [])
            sub_rows = []
            for sp_idx, sp in enumerate(sub_parts):
                sp_part = sp.get("part", f"({chr(97+sp_idx)})")
                sp_text = _format_exam_text(sp.get("question_text", ""))
                sp_marks = sp.get("marks", round(total_lq_marks / max(1, len(sub_parts)), 1))
                sp_formula = sp.get("formula", "")

                sp_content = [Paragraph(f"<b>{sp_part}</b> {sp_text}", q_text_style)]
                if sp_formula:
                    f_path = os.path.join(tmp_dir, f"sec_b_f_{l_idx}_{sp_idx}.png")
                    try:
                        res = _render_formula_image(sp_formula, f_path)
                        if res:
                            img_path, pt_w, pt_h = res
                            sp_content.append(Spacer(1, 2))
                            sp_content.append(RLImage(img_path, width=pt_w, height=pt_h, hAlign="LEFT"))
                            sp_content.append(Spacer(1, 2))
                    except Exception:
                        clean_sp_f = _format_exam_text(sp_formula)
                        sp_content.append(Paragraph(f"<i>Formula: {clean_sp_f}</i>", q_text_style))

                if is_solution and sp.get("solution"):
                    sol = sp["solution"]
                    sol_flows = [Spacer(1, 4), Paragraph(f"<b>Solution for {sp_part}:</b>", sol_header_style)]
                    for step in sol.get("steps", []):
                        sol_flows.append(Paragraph(f"• {_format_exam_text(step)}", sol_step_style))
                    if sol.get("final_answer"):
                        sol_flows.append(Paragraph(f"<b>Result / Conclusion:</b> {_format_exam_text(sol['final_answer'])}", sol_step_style))
                    if sol.get("marking_scheme"):
                        sol_flows.append(Paragraph(f"<b>Marking Rubric:</b> {_format_exam_text(sol['marking_scheme'])}", rubric_style))
                    sp_content.extend(sol_flows)

                sub_rows.append([
                    sp_content,
                    Paragraph(f"[{sp_marks}]", marks_style)
                ])

            sub_table = Table(sub_rows, colWidths=[6.0 * inch, 0.7 * inch])
            sub_table.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]))

            card_row = [
                [lq_header, sub_table]
            ]
            card_table = Table(card_row, colWidths=[0.3 * inch, 6.7 * inch])
            card_table.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#d1d5db")),
            ]))

            story.append(KeepTogether([card_table]))
            story.append(Spacer(1, 4))

        # End of Exam Marker
        story.append(Spacer(1, 10))
        story.append(Paragraph("<b>--- END OF PAPER ---</b>", ParagraphStyle("EndPaper", parent=univ_sub_style, alignment=1, spaceBefore=8)))

        # Build Document with NumberedCanvas
        doc = SimpleDocTemplate(
            out_path,
            pagesize=A4,
            leftMargin=0.55 * inch,
            rightMargin=0.55 * inch,
            topMargin=0.55 * inch,
            bottomMargin=0.65 * inch,
            title=f"{subject_name} {paper_data.get('exam_title', 'Mock Exam')}",
            author="KIIT Orchids Mock Portal"
        )
        doc.build(story, canvasmaker=NumberedCanvas)

    return filename
