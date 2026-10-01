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

MOCK_DIR = os.path.join(tempfile.gettempdir(), "pyq_mock_papers")
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
    - Converts inline LaTeX math ($...$, $$...$$, \(...\), \[...\]) to clean, elegant academic typography.
    - Preserves all math without deleting equations into gibberish.
    """
    if not text:
        return ""

    # Greek letters mapping
    greek_map = {
        r"\alpha": "α", r"\beta": "β", r"\gamma": "γ", r"\delta": "δ", r"\epsilon": "ε",
        r"\zeta": "ζ", r"\eta": "η", r"\theta": "θ", r"\iota": "ι", r"\kappa": "κ",
        r"\lambda": "λ", r"\mu": "μ", r"\nu": "ν", r"\xi": "ξ", r"\pi": "π",
        r"\rho": "ρ", r"\sigma": "σ", r"\tau": "τ", r"\upsilon": "υ", r"\phi": "φ",
        r"\chi": "χ", r"\psi": "ψ", r"\omega": "ω",
        r"\Gamma": "Γ", r"\Delta": "Δ", r"\Theta": "Θ", r"\Lambda": "Λ", r"\Xi": "Ξ",
        r"\Pi": "Π", r"\Sigma": "Σ", r"\Upsilon": "Υ", r"\Phi": "Φ", r"\Psi": "Ψ",
        r"\Omega": "Ω"
    }

    # Math symbols & operators mapping
    symbol_map = {
        r"\times": " × ", r"\cdot": " · ", r"\div": " ÷ ", r"\pm": " ± ", r"\mp": " ∓ ",
        r"\le": " ≤ ", r"\leq": " ≤ ", r"\ge": " ≥ ", r"\geq": " ≥ ",
        r"\neq": " ≠ ", r"\ne": " ≠ ", r"\approx": " ≈ ", r"\equiv": " ≡ ",
        r"\sim": " ~ ", r"\propto": " ∝ ", r"\infty": " ∞ ", r"\partial": "∂",
        r"\nabla": "∇", r"\int": "∫", r"\iint": "∬", r"\iiint": "∭", r"\oint": "∮",
        r"\sum": "∑", r"\prod": "∏",
        r"\rightarrow": " → ", r"\to": " → ", r"\leftarrow": " ← ", r"\gets": " ← ",
        r"\leftrightarrow": " ↔ ", r"\Rightarrow": " ⇒ ", r"\Leftarrow": " ⇐ ", r"\Leftrightarrow": " ⇔ ",
        r"\in": " ∈ ", r"\notin": " ∉ ", r"\subset": " ⊂ ", r"\subseteq": " ⊆ ",
        r"\supset": " ⊃ ", r"\supseteq": " ⊇ ", r"\cup": " ∪ ", r"\cap": " ∩ ",
        r"\forall": "∀", r"\exists": "∃", r"\therefore": "∴", r"\because": "∵",
        r"\perp": " ⊥ ", r"\angle": "∠", r"\circ": "°",
        r"\mathcal{O}": "O", r"\text{O}": "O", r"\mathbf{O}": "O",
        r"\mathcal{T}": "T", r"\mathcal{L}": "L", r"\mathcal{H}": "H",
        r"\quad": "  ", r"\qquad": "    ", r"\ ": " ",
    }

    def _convert_math_expr(s):
        s = s.strip()
        # Clean control characters if any
        s = re.sub(r'\x0c([a-zA-Z]+)', r'\\f\1', s)
        s = re.sub(r'\x08([a-zA-Z]+)', r'\\b\1', s)
        s = re.sub(r'\t(heta|au|imes|o|an|ext|ilde|riangle|op)', r'\\t\1', s)
        s = re.sub(r'\n(eq|abla|u|ot|atural)', r'\\n\1', s)
        s = re.sub(r'\r(ho|ight|angle|rightarrow)', r'\\r\1', s)

        # Replace Greek letters
        for latex_cmd, unic in greek_map.items():
            s = s.replace(latex_cmd, unic)

        # Replace symbols
        for latex_cmd, unic in symbol_map.items():
            s = s.replace(latex_cmd, unic)

        # Fractions: \frac{a}{b} -> (a / b)
        s = re.sub(r"\\frac\{([^}]+)\}\{([^}]+)\}", r"(\1 / \2)", s)
        # Sqrt: \sqrt{x} -> √(x)
        s = re.sub(r"\\sqrt\{([^}]+)\}", r"√(\1)", s)
        # Sqrt with n: \sqrt[n]{x} -> ⁿ√(x)
        s = re.sub(r"\\sqrt\[([^\]]+)\]\{([^}]+)\}", r"<sup>\1</sup>√(\2)", s)

        # Superscripts: ^{abc} -> <sup>abc</sup>, ^2 -> <sup>2</sup>
        s = re.sub(r"\^\{([^}]+)\}", r"<sup>\1</sup>", s)
        s = re.sub(r"\^([a-zA-Z0-9+\-]+)", r"<sup>\1</sup>", s)

        # Subscripts: _{abc} -> <sub>abc</sub>, _i -> <sub>i</sub>
        s = re.sub(r"_\{([^}]+)\}", r"<sub>\1</sub>", s)
        s = re.sub(r"_([a-zA-Z0-9+\-]+)", r"<sub>\1</sub>", s)

        # Cleanup text/mathrm/mathbf wrappers: \text{foo} -> foo
        s = re.sub(r"\\(?:text|mathrm|mathbf|mathit|textbf|textit|bm)\{([^}]+)\}", r"\1", s)

        # Clean left/right parens/brackets: \left( \right) -> ( )
        s = re.sub(r"\\left([(\[{|])", r"\1", s)
        s = re.sub(r"\\right([)\]}|])", r"\1", s)

        # Strip remaining function backslashes safely while keeping function name
        s = re.sub(r"\\(sin|cos|tan|cot|sec|csc|log|ln|exp|lim|max|min|sup|inf|det|dim|ker|deg)\b", r"\1", s)

        # Strip lone backslashes
        s = re.sub(r"\\(?=[a-zA-Z])", "", s)

        return f"<i>{s}</i>"

    # Step 1: Escape XML characters in plain text
    clean = str(text)
    clean = clean.replace("&", "&amp;")
    clean = clean.replace("<", "&lt;").replace(">", "&gt;")

    # Step 2: Convert block and inline LaTeX delimiters
    clean = re.sub(r"\$\$([\s\S]+?)\$\$", lambda m: _convert_math_expr(m.group(1)), clean)
    clean = re.sub(r"\\\[([\s\S]+?)\\\]", lambda m: _convert_math_expr(m.group(1)), clean)
    clean = re.sub(r"\$([^\$]+?)\$", lambda m: _convert_math_expr(m.group(1)), clean)
    clean = re.sub(r"\\\(([\s\S]+?)\\\)", lambda m: _convert_math_expr(m.group(1)), clean)

    # Step 3: Handle bare symbols outside math mode if present
    for latex_cmd, unic in greek_map.items():
        clean = clean.replace(latex_cmd, unic)
    for latex_cmd, unic in symbol_map.items():
        clean = clean.replace(latex_cmd, unic)

    return clean


def _render_formula_image(latex_str, out_path, fontsize=11, dpi=250):
    """
    Render a single LaTeX formula string to a transparent PNG via matplotlib mathtext.
    Returns: (out_path, width_pt, height_pt) with true scaled dimensions for ReportLab.
    """
    clean_latex = str(latex_str).strip().strip("$").strip()
    # Clean control characters if any
    clean_latex = re.sub(r'\x0c([a-zA-Z]+)', r'\\f\1', clean_latex)
    clean_latex = re.sub(r'\x08([a-zA-Z]+)', r'\\b\1', clean_latex)
    clean_latex = re.sub(r'\t(heta|au|imes|o|an|ext|ilde|riangle|op)', r'\\t\1', clean_latex)
    clean_latex = re.sub(r'\n(eq|abla|u|ot|atural)', r'\\n\1', clean_latex)
    clean_latex = re.sub(r'\r(ho|ight|angle|rightarrow)', r'\\r\1', clean_latex)
    clean_latex = re.sub(r'(?<!\\)\brac\{', r'\\frac{', clean_latex)

    # Normalize macros for matplotlib mathtext
    clean_latex = clean_latex.replace(r"\text{", r"\mathrm{")
    clean_latex = clean_latex.replace(r"\bm{", r"\mathbf{")
    clean_latex = clean_latex.replace(r"\boldsymbol{", r"\mathbf{")

    if not clean_latex:
        raise ValueError("Empty formula string")

    fig = plt.figure(figsize=(0.1, 0.1))
    try:
        text_obj = fig.text(0, 0, f"${clean_latex}$", fontsize=fontsize, color="#111827")
        fig.canvas.draw()
        bbox = text_obj.get_window_extent()
        width_in = bbox.width / fig.dpi + 0.08
        height_in = bbox.height / fig.dpi + 0.08
        fig.set_size_inches(width_in, height_in)
        text_obj.set_position((0.02, 0.12))
        fig.savefig(out_path, dpi=dpi, transparent=True, bbox_inches="tight", pad_inches=0.03)

        from PIL import Image
        with Image.open(out_path) as img:
            px_w, px_h = img.size

        # Convert pixels to points (1 in = 72 pt)
        pt_w = px_w * (72.0 / dpi)
        pt_h = px_h * (72.0 / dpi)

        # Restrict max width and keep proportional
        max_w = 420.0
        if pt_w > max_w:
            scale = max_w / pt_w
            pt_w = max_w
            pt_h = pt_h * scale

        return out_path, pt_w, pt_h
    finally:
        plt.close(fig)


def _extract_markdown_tables_and_text(raw_text):
    """
    Parses a text block that may contain markdown tables.
    Returns a list of segment dicts:
    [
      {"type": "text", "content": "..."},
      {"type": "table", "headers": [...], "rows": [[...], ...]},
      ...
    ]
    """
    if not raw_text:
        return []

    # Normalize literal \n or mixed line endings
    text = str(raw_text)
    text = text.replace(r"\r\n", "\n").replace(r"\n", "\n").replace("\r\n", "\n").replace("\r", "\n")

    # Fix inline jammed tables where separator is on the same line as header or data
    text = re.sub(r'(\|?[^\n|]+(?:\|[^\n|]+)+\|?)\s+((?:[\s:]*-+[\s:]*\|)+[\s:\-\|]+)', r'\1\n\2', text)
    text = re.sub(r'((?:[\s:]*-+[\s:]*\|)+[\s:\-\|]+)\s+(\|?[^\n|]+\|[^\n]+)', r'\1\n\2', text)

    table_pattern = re.compile(
        r'(?:^|\n)'
        r'([ \t]*\|?[^\n\|]+\|[^\n]+\|?[ \t]*\n)'
        r'([ \t]*\|?[\s:]*-+[\s:]*\|[\s:\-\|\+]+[ \t]*\n)'
        r'((?:[ \t]*\|?[^\n\|]+\|[^\n]+\|?[ \t]*(?:\n|$))+)',
        re.MULTILINE
    )

    segments = []
    last_end = 0

    for match in table_pattern.finditer(text):
        start = match.start()
        end = match.end()

        pre_text = text[last_end:start].strip()
        if pre_text:
            segments.append({"type": "text", "content": pre_text})

        header_line = match.group(1).strip()
        data_block = match.group(3).strip()

        headers = [c.strip() for c in header_line.strip('|').split('|') if c.strip() != '']
        rows = []
        for line in data_block.split('\n'):
            line = line.strip()
            if not line:
                continue
            cells = [c.strip() for c in line.strip('|').split('|')]
            if len(cells) > 0 and any(c != '' for c in cells):
                rows.append(cells)

        if headers and rows:
            segments.append({
                "type": "table",
                "headers": headers,
                "rows": rows
            })
        else:
            segments.append({"type": "text", "content": match.group(0).strip()})

        last_end = end

    post_text = text[last_end:].strip()
    if post_text:
        segments.append({"type": "text", "content": post_text})

    return segments if segments else [{"type": "text", "content": text.strip()}]


def _build_styled_reportlab_table(headers, rows, total_width=5.8 * inch):
    """
    Builds a beautifully styled, compact ReportLab Table Flowable from parsed headers & rows.
    """
    styles = getSampleStyleSheet()
    th_style = ParagraphStyle(
        "THStyle", parent=styles["Normal"],
        fontName="Times-Bold", fontSize=8.5, leading=11,
        alignment=1, textColor=colors.HexColor("#0f172a")
    )
    td_style = ParagraphStyle(
        "TDStyle", parent=styles["Normal"],
        fontName="Times-Roman", fontSize=8.5, leading=11,
        alignment=1, textColor=colors.HexColor("#1e293b")
    )

    num_cols = max(len(headers), max((len(r) for r in rows), default=1))

    norm_headers = [Paragraph(_format_exam_text(h), th_style) for h in headers]
    while len(norm_headers) < num_cols:
        norm_headers.append(Paragraph("", th_style))

    table_data = [norm_headers]
    for r in rows:
        row_cells = [Paragraph(_format_exam_text(c), td_style) for c in r]
        while len(row_cells) < num_cols:
            row_cells.append(Paragraph("", td_style))
        table_data.append(row_cells)

    col_w = total_width / float(num_cols)
    col_widths = [col_w] * num_cols

    rl_table = Table(table_data, colWidths=col_widths, hAlign="LEFT")

    t_style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#64748b")),
    ]

    for row_idx in range(1, len(table_data)):
        if row_idx % 2 == 0:
            t_style.append(("BACKGROUND", (0, row_idx), (-1, row_idx), colors.HexColor("#f8fafc")))

    rl_table.setStyle(TableStyle(t_style))
    return rl_table


def _render_question_flowables(raw_text, base_style, prefix="", total_width=5.8 * inch):
    """
    Renders question or solution text into flowables, splitting out any embedded tables.
    """
    segments = _extract_markdown_tables_and_text(raw_text)
    flowables = []
    prefix_applied = False

    for seg in segments:
        if seg["type"] == "table":
            flowables.append(Spacer(1, 3))
            flowables.append(_build_styled_reportlab_table(seg["headers"], seg["rows"], total_width=total_width))
            flowables.append(Spacer(1, 3))
        else:
            txt = _format_exam_text(seg["content"])
            if prefix and not prefix_applied:
                if prefix.endswith(":") or prefix == "•":
                    flowables.append(Paragraph(f"<b>{prefix}</b> {txt}" if prefix.endswith(":") else f"{prefix} {txt}", base_style))
                else:
                    flowables.append(Paragraph(f"<b>{prefix}</b> {txt}", base_style))
                prefix_applied = True
            else:
                flowables.append(Paragraph(txt, base_style))

    if prefix and not prefix_applied:
        flowables.append(Paragraph(f"<b>{prefix}</b>", base_style))

    return flowables


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
        half_count = n / 2.0
        selected_units = []
        for i, u in enumerate(all_units):
            if i + 1 <= math.floor(half_count):
                selected_units.append(u)
            elif i + 1 == math.ceil(half_count) and (n % 2 != 0):
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


def _retrieve_grounded_pyqs(subject_name, exam_type, syllabus_scope, max_samples=30):
    """
    Retrieve rich, structured Previous Year Question (PYQ) samples from ChromaDB
    aligned with the exam type (Midsem vs Endsem) and syllabus scope units.
    Returns: A formatted string of past exam questions categorized by 1-mark and long questions.
    """
    try:
        # Query ChromaDB with $eq syntax
        results = collection.get(
            where={"$and": [{"subject": {"$eq": subject_name}}, {"doc_type": {"$eq": "pyq"}}]},
            include=["documents", "metadatas"]
        )
        docs = results.get("documents", [])
        metas = results.get("metadatas", [])

        if not docs:
            # Fallback query
            fallback_res = collection.get(
                where={"subject": subject_name},
                include=["documents", "metadatas"]
            )
            for d, m in zip(fallback_res.get("documents", []), fallback_res.get("metadatas", [])):
                if m.get("doc_type") == "pyq":
                    docs.append(d)
                    metas.append(m)

        if not docs:
            return "No previous year question records found for this subject."

        norm_exam = "midsem" if "mid" in exam_type.lower() else "endsem"
        scope_unit_names = {u.get("unit", "").lower() for u in syllabus_scope.get("units", []) if u.get("unit")}

        # Categorize into Compulsory 1-Mark vs Long Questions
        short_compulsory = []
        long_questions = []
        other_questions = []

        for doc, meta in zip(docs, metas):
            qtext = doc.strip()
            if not qtext:
                continue

            year = meta.get("year", "Past Year")
            q_exam = meta.get("exam_type", "Exam")
            qnum = str(meta.get("question_number", ""))
            unit = meta.get("unit", "")
            topic = meta.get("topic", "")

            # For Midsem, filter/prioritize questions from scope units
            is_in_scope = True
            if norm_exam == "midsem" and scope_unit_names and unit:
                if unit.lower() not in scope_unit_names and not any(su in unit.lower() for su in scope_unit_names):
                    # Lower priority for out-of-scope units in midsem
                    is_in_scope = False

            item = {
                "year": year,
                "exam_type": q_exam,
                "qnum": qnum,
                "unit": unit,
                "topic": topic,
                "text": qtext[:1000],  # Full rich text
                "is_in_scope": is_in_scope,
                "is_exam_match": norm_exam in q_exam.lower()
            }

            # Classify by question type
            # 1-mark or subpart 1(a), 1(b) etc.
            if qnum.startswith("1") or "(a)" in qnum or "(b)" in qnum or "define" in qtext.lower()[:30] or "what is" in qtext.lower()[:30] or "state" in qtext.lower()[:30]:
                if len(qtext) < 400 or qnum.startswith("1"):
                    short_compulsory.append(item)
                else:
                    long_questions.append(item)
            else:
                long_questions.append(item)

        # Prioritize items that match exam type and are in scope
        def _sort_key(item):
            score = 0
            if item["is_in_scope"]:
                score += 10
            if item["is_exam_match"]:
                score += 5
            try:
                score += int(item["year"]) / 1000.0
            except Exception:
                pass
            return score

        short_compulsory.sort(key=_sort_key, reverse=True)
        long_questions.sort(key=_sort_key, reverse=True)

        selected_short = short_compulsory[:12]
        selected_long = long_questions[:18]

        output_sections = []

        if selected_short:
            short_lines = []
            for item in selected_short:
                tag = f"[{item['year']} {item['exam_type']} Q{item['qnum']}]"
                if item['unit'] and item['unit'] != 'Unclassified':
                    tag += f" ({item['unit']} - {item['topic']})"
                short_lines.append(f"{tag}:\n{item['text']}")
            output_sections.append("### ACTUAL PAST 1-MARK & SHORT CONCEPTUAL QUESTIONS:\n" + "\n\n".join(short_lines))

        if selected_long:
            long_lines = []
            for item in selected_long:
                tag = f"[{item['year']} {item['exam_type']} Q{item['qnum']}]"
                if item['unit'] and item['unit'] != 'Unclassified':
                    tag += f" ({item['unit']} - {item['topic']})"
                long_lines.append(f"{tag}:\n{item['text']}")
            output_sections.append("### ACTUAL PAST LONG & MULTI-PART QUESTIONS (DERIVATIONS, PROBLEMS, PROOFS):\n" + "\n\n".join(long_lines))

        return "\n\n".join(output_sections)

    except Exception as e:
        logger.warning(f"Error retrieving grounded PYQs: {e}")
        return "Standard rigorous KIIT university engineering past questions."


def build_exam_generation_prompt(subject_name, exam_type, semester, syllabus_scope, pyq_grounding):
    norm_type = "Midsem" if "mid" in exam_type.lower() else "Endsem"
    units_text = []
    for u in syllabus_scope["units"]:
        topics = ", ".join(u.get("topics", []))
        units_text.append(f"• {u.get('unit', '')} ({u.get('title', '')}): {topics}")
    syllabus_str = "\n".join(units_text)

    if norm_type == "Midsem":
        blueprint_instructions = """
BLUEPRINT SPECIFICATIONS FOR MIDSEM EXAMINATION (Total Marks: 20 | Time: 1.5 Hours):
1. **Syllabus Coverage & PYQ Synergy**:
   - Every question MUST be drawn from the provided half-syllabus units.
   - Questions MUST reflect the authentic styles, recurring question themes, formula derivations, definitions, and problem types found in the KIIT Past Year Questions (PYQs).
2. **Question Structure**:
   - **Question 1 (Compulsory - Total: 5 Marks)**: Exactly 5 one-mark sub-questions: 1(a), 1(b), 1(c), 1(d), 1(e).
     - Each sub-question is worth 1 mark.
     - Direct definitions, short reasoning, core properties, or quick formula applications matching past Q1 styles.
   - **Questions 2, 3, 4, 5 (Long Questions - Answer any THREE | 3 × 5 = 15 Marks)**:
     - Exactly 4 long questions: Q.2, Q.3, Q.4, Q.5 (3 required + 1 choice).
     - Each question has sub-parts e.g. (a) [2.5] + (b) [2.5] = 5 Marks, or (a) [3] + (b) [2] = 5 Marks, summing EXACTLY to 5 MARKS per question.
     - Modeled directly after actual KIIT past examination problem formulations, mathematical derivations, algorithm steps, and proofs.
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
        "question_text": "...",
        "marks": 1,
        "topic": "...",
        "formula": "",
        "solution": {
          "steps": ["Step 1 explanation / formula", "Final conclusion"],
          "final_answer": "...",
          "marking_scheme": "[1 Mark] for correct definition / formula"
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
              "steps": ["Step 1: Formula definition", "Step 2: Substitution & solving"],
              "final_answer": "...",
              "marking_scheme": "[1 Mark] for setup, [1.5 Marks] for derivation"
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
              "marking_scheme": "[1 Mark] for concept, [1.5 Marks] for computation"
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
1. **Syllabus Coverage & PYQ Synergy**:
   - Questions MUST span across the entire course syllabus (all units) in balanced proportion.
   - Questions MUST reflect the authentic styles, recurring question themes, formula derivations, definitions, and problem types found in the KIIT Past Year Questions (PYQs).
2. **Question Structure**:
   - **Question 1 (Compulsory - Total: 10 Marks)**: Exactly 10 one-mark sub-questions: 1(a) to 1(j).
     - Each sub-question is worth 1 mark.
     - Conceptual definitions, properties, short calculations, formula statements, or short proofs matching past Q1 styles.
   - **Questions 2, 3, 4, 5, 6, 7 (Long Questions - Answer any FOUR | 4 × 10 = 40 Marks)**:
     - Exactly 6 long questions: Q.2, Q.3, Q.4, Q.5, Q.6, Q.7 (4 required + 2 choices).
     - Each question has sub-parts e.g. (a) [5] + (b) [5] = 10 Marks, or (a) [4] + (b) [6] = 10 Marks, summing EXACTLY to 10 MARKS per question.
     - Modeled directly after actual KIIT past examination problem formulations, mathematical derivations, algorithm steps, circuit/data designs, and proofs.
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
            "formula": "\\\\int_0^\\\\infty e^{-x^2} dx = \\\\frac{\\\\sqrt{\\\\pi}}{2}",
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
              "marking_scheme": "[2 Marks] for theory, [3 Marks] for working"
            }
          }
        ]
      }
    ]
  }
}"""

    prompt = f"""You are the Chief Examination Controller and Senior Professor at KIIT University designing an authentic, high-quality university {norm_type} Examination Question Paper and comprehensive Solution Key for the course: "{subject_name}" ({semester or 'B.Tech'}).

COURSE SYLLABUS SCOPE (MANDATORY BOUNDARIES):
---
{syllabus_str}
---

KIIT PREVIOUS YEAR QUESTIONS (PYQ GROUNDING & STYLE BENCHMARK):
---
The following are ACTUAL questions from past KIIT University examinations in this subject. You MUST use them to ground your question styles, numerical problem archetypes, formula questions, proofs, and difficulty levels:

{pyq_grounding}
---

{blueprint_instructions}

CRITICAL RULES:
1. **PYQ + Syllabus Dual Grounding**:
   - Synthesize questions that rigorously cover the topics in the syllabus scope, while reflecting the recurring problem archetypes, mathematical derivations, question phrasings, and standard KIIT academic rigor shown in the past examination papers above.
2. **Mathematical / Scientific Formulas & Equations**:
   - Format all mathematical formulas, differential equations, integrals, summations, matrices, limits, and notation using valid, clean LaTeX syntax (e.g. `\\\\int_0^\\\\infty e^{{-x^2}} dx`, `\\\\frac{{d^2y}}{{dx^2}} + \\\\omega^2 y = 0`, `\\\\sum_{{i=1}}^n i^2`, `\\\\lim_{{x \\\\to 0}} \\\\frac{{\\\\sin x}}{{x}} = 1`).
   - If a question or sub-part has a primary equation or formula, provide it explicitly in the `"formula"` field.
3. **JSON Escaping**:
   - Every single backslash in LaTeX strings MUST be double escaped (`\\\\frac`, `\\\\sqrt`, `\\\\alpha`, `\\\\beta`, `\\\\theta`, `\\\\lambda`, `\\\\in`, `\\\\le`, etc.) so that the output parses cleanly as JSON.
4. **Rigorous Step-by-Step Solutions & Point-by-Point Marking Rubrics**:
   - For every question and sub-part, provide complete, step-by-step mathematical/theoretical working in `"steps"`.
   - Provide the concise `"final_answer"`.
   - Include a clear, point-by-point marking scheme in `"marking_scheme"` (e.g. "[1 Mark] for theorem definition, [2 Marks] for substitution, [2 Marks] for final result").
5. **Exact Mark Allocations**:
   - For Midsem: Q1 has 5 × 1m = 5m. Q2, Q3, Q4, Q5 each have sub-parts summing strictly to 5 marks.
   - For Endsem: Q1 has 10 × 1m = 10m. Q2, Q3, Q4, Q5, Q6, Q7 each have sub-parts summing strictly to 10 marks.
6. **Data Tables & Matrices (Scheduling, Page Reference, Truth Tables, Cost Matrices)**:
   - When questions or solution steps contain process scheduling tables, burst patterns, page frames, cost matrices, or truth tables, format them cleanly using standard Markdown table syntax with explicit newlines between each row, e.g.:
     `Process | Arrival | CPU Burst | I/O Burst\n---|---|---|---\nP1 | 0 | 4 | 2\nP2 | 1 | 3 | 1`
   - NEVER mash rows together into a single line without newlines.
7. **Output Format**: Respond ONLY with a single valid JSON object matching this schema without markdown codeblocks or preamble:

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
    pyq_grounding = _retrieve_grounded_pyqs(subject_name, exam_type, syllabus_scope)

    prompt = build_exam_generation_prompt(
        subject_name=subject_name,
        exam_type=exam_type,
        semester=semester,
        syllabus_scope=syllabus_scope,
        pyq_grounding=pyq_grounding
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
            raw_qtext = q.get("question_text", "")
            qmarks = q.get("marks", 1)
            formula = q.get("formula", "")

            # Row layout: [Question text + embedded tables + formula] [Marks]
            q_flowables = _render_question_flowables(raw_qtext, q_text_style, prefix=qid, total_width=6.1 * inch)
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
                    sol_flows.extend(_render_question_flowables(step, sol_step_style, prefix="•", total_width=6.1 * inch))
                if sol.get("final_answer"):
                    sol_flows.extend(_render_question_flowables(sol["final_answer"], sol_step_style, prefix="Answer:", total_width=6.1 * inch))
                if sol.get("marking_scheme"):
                    sol_flows.extend(_render_question_flowables(sol["marking_scheme"], rubric_style, prefix="Marking Rubric:", total_width=6.1 * inch))
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
                raw_sp_text = sp.get("question_text", "")
                sp_marks = sp.get("marks", round(total_lq_marks / max(1, len(sub_parts)), 1))
                sp_formula = sp.get("formula", "")

                sp_content = _render_question_flowables(raw_sp_text, q_text_style, prefix=sp_part, total_width=5.8 * inch)
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
                        sol_flows.extend(_render_question_flowables(step, sol_step_style, prefix="•", total_width=5.8 * inch))
                    if sol.get("final_answer"):
                        sol_flows.extend(_render_question_flowables(sol["final_answer"], sol_step_style, prefix="Result / Conclusion:", total_width=5.8 * inch))
                    if sol.get("marking_scheme"):
                        sol_flows.extend(_render_question_flowables(sol["marking_scheme"], rubric_style, prefix="Marking Rubric:", total_width=5.8 * inch))
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
