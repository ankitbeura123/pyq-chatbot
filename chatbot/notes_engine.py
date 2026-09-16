import os
import re
import uuid
import tempfile

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
    ListFlowable, ListItem, HRFlowable, Table, TableStyle
)

from .gemini_utils import call_gemini_json

NOTES_DIR = os.path.join(settings.BASE_DIR, "revision_notes")
os.makedirs(NOTES_DIR, exist_ok=True)


class NotesGenerationError(Exception):
    pass


NOTES_PROMPT_TEMPLATE = """You are an expert exam-revision note writer for a college engineering student
preparing for a "{subject_context}" exam.

Write comprehensive, exam-focused revision notes on the topic: "{topic}".

Return ONLY valid JSON (no markdown fences, no preamble, no commentary) matching exactly this schema:

{{
  "title": "string - clean topic title",
  "intro": "string - 2-3 sentence overview of the topic and why it matters for exams",
  "sections": [
    {{
      "heading": "string - section heading, e.g. 'Definition', 'Key Properties', 'Derivation', 'Applications'",
      "body_points": ["string bullet point", "..."],
      "formulas": ["string - a single formula in LaTeX math syntax, e.g. 'E = mc^2', WITHOUT dollar signs, WITH double backslashes like \\\\frac{{a}}{{b}}"],
      "diagram": {{
        "type": "bar" or "flow" or "none",
        "title": "short chart/diagram title",
        "labels": ["stage or category names, only if type is bar or flow, else omit"],
        "values": [numeric values, ONLY if type is 'bar', matching labels length]
      }}
    }}
  ],
  "key_terms": [{{"term": "string", "definition": "string, one sentence"}}],
  "exam_tips": ["string - short actionable exam tip"]
}}

Rules:
- Produce 4 to 7 sections covering definition, theory/derivation, key formulas, diagrams/processes, comparisons, and applications as relevant to the topic.
- Only include "formulas" where the topic genuinely has mathematical/chemical formulas; otherwise use an empty list.
- Only set diagram type to "bar" if you have real comparable numeric data worth charting; set to "flow" if the section describes a sequential process (list 3-6 short stage names in "labels" and omit "values"); otherwise use "none" and omit labels/values.
- Keep body_points concise, exam-oriented, one idea per bullet, 3 to 6 points per section.
- VERY IMPORTANT FOR JSON VALIDITY: Always escape every backslash in formulas with double backslashes (e.g. \\\\frac, \\\\sum, \\\\alpha, \\\\theta, \\\\mathcal{{O}}) so the output parses cleanly as JSON.
- All LaTeX must be valid matplotlib mathtext (basic subset: ^, _, \\frac, \\sqrt, \\sum, \\int, Greek letters like \\alpha, \\theta). Do not use unsupported LaTeX packages/environments.
- Provide 4-8 key_terms and 3-5 exam_tips.
"""


def _sanitize_filename_part(text):
    text = re.sub(r"[^a-zA-Z0-9\- ]", "", text).strip()
    text = re.sub(r"\s+", "_", text)
    return text[:60] or "topic"


def _render_formula_image(latex_str, out_path, fontsize=18):
    """Render a single LaTeX formula string to a transparent PNG via matplotlib mathtext."""
    clean_latex = str(latex_str).strip().strip("$").strip()
    if not clean_latex:
        raise ValueError("Empty formula string")
    fig = plt.figure(figsize=(0.1, 0.1))
    try:
        text_obj = fig.text(0, 0, f"${clean_latex}$", fontsize=fontsize, color="#1a1a1a")
        fig.canvas.draw()
        bbox = text_obj.get_window_extent()
        width_in = bbox.width / fig.dpi + 0.2
        height_in = bbox.height / fig.dpi + 0.2
        fig.set_size_inches(width_in, height_in)
        text_obj.set_position((0.05, 0.15))
        fig.savefig(out_path, dpi=200, transparent=True, bbox_inches="tight", pad_inches=0.05)
    finally:
        plt.close(fig)


def _render_bar_chart(title, labels, values, out_path):
    if not labels or not values or len(labels) != len(values):
        return
    try:
        num_values = [float(v) for v in values]
        str_labels = [str(l) for l in labels]
    except (ValueError, TypeError):
        return

    fig, ax = plt.subplots(figsize=(5, 2.6))
    ax.bar(str_labels, num_values, color="#8f6fd6")
    ax.set_title(str(title), fontsize=11)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    plt.xticks(rotation=20, ha="right", fontsize=8)
    plt.yticks(fontsize=8)
    fig.tight_layout()
    fig.savefig(out_path, dpi=200, transparent=True)
    plt.close(fig)


def _render_flow_diagram(title, labels, out_path):
    str_labels = [str(l) for l in labels if l]
    n = len(str_labels)
    if n == 0:
        return
    fig_width = max(6, n * 1.7)
    fig, ax = plt.subplots(figsize=(fig_width, 1.8))
    ax.set_xlim(0, n)
    ax.set_ylim(0, 1)
    ax.axis("off")
    ax.set_title(str(title), fontsize=11, pad=14)
    for i, label in enumerate(str_labels):
        box = plt.Rectangle((i + 0.08, 0.25), 0.84, 0.5, facecolor="#2b2140",
                             edgecolor="#8f6fd6", linewidth=1.4)
        ax.add_patch(box)
        ax.text(i + 0.5, 0.5, label, ha="center", va="center", fontsize=8, color="white", wrap=True)
        if i < n - 1:
            ax.annotate("", xy=(i + 1.06, 0.5), xytext=(i + 0.92, 0.5),
                        arrowprops=dict(arrowstyle="->", color="#E4B667", lw=1.6))
    fig.tight_layout()
    fig.savefig(out_path, dpi=200, transparent=True)
    plt.close(fig)


def generate_revision_notes(topic, subject_name=None):
    """Calls Gemini to produce structured revision notes JSON for a topic."""
    subject_context = subject_name or "the relevant college engineering course"
    prompt = NOTES_PROMPT_TEMPLATE.format(topic=topic, subject_context=subject_context)
    try:
        data = call_gemini_json(prompt)
    except Exception as e:
        raise NotesGenerationError(f"Failed to generate notes: {e}")

    if not isinstance(data, dict) or "sections" not in data:
        raise NotesGenerationError("Gemini returned an unexpected notes format.")

    return data


def build_notes_pdf(notes_data, topic):
    """Renders notes_data into a PDF. Returns the filename (basename only) saved inside NOTES_DIR."""

    note_id = uuid.uuid4().hex[:12]
    filename = f"{_sanitize_filename_part(topic)}_{note_id}.pdf"
    out_path = os.path.join(NOTES_DIR, filename)

    with tempfile.TemporaryDirectory() as tmp_dir:
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "NotesTitle", parent=styles["Title"], fontSize=22, spaceAfter=6,
            textColor=colors.HexColor("#2b2140"),
        )
        intro_style = ParagraphStyle(
            "Intro", parent=styles["BodyText"], fontSize=10.5, leading=15,
            textColor=colors.HexColor("#3a3a3a"), spaceAfter=14,
        )
        heading_style = ParagraphStyle(
            "SectionHeading", parent=styles["Heading2"], fontSize=14,
            spaceBefore=14, spaceAfter=6, textColor=colors.HexColor("#8f6fd6"),
        )
        bullet_style = ParagraphStyle("Bullet", parent=styles["BodyText"], fontSize=10.2, leading=14.5)
        term_style = ParagraphStyle("Term", parent=styles["BodyText"], fontSize=10, leading=14)
        tip_style = ParagraphStyle(
            "Tip", parent=styles["BodyText"], fontSize=10.2, leading=14.5,
            textColor=colors.HexColor("#4a3b00"),
        )

        story = []
        story.append(Paragraph(notes_data.get("title", topic), title_style))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cfc4e8")))
        story.append(Spacer(1, 10))

        if notes_data.get("intro"):
            story.append(Paragraph(notes_data["intro"], intro_style))

        for sec_idx, section in enumerate(notes_data.get("sections", [])):
            heading = section.get("heading", f"Section {sec_idx + 1}")
            story.append(Paragraph(heading, heading_style))

            body_points = section.get("body_points") or []
            if body_points:
                items = [ListItem(Paragraph(pt, bullet_style), leftIndent=10) for pt in body_points]
                story.append(ListFlowable(items, bulletType="bullet", start="•", leftIndent=14))
                story.append(Spacer(1, 6))

            for f_idx, formula in enumerate(section.get("formulas") or []):
                img_path = os.path.join(tmp_dir, f"formula_{sec_idx}_{f_idx}.png")
                try:
                    _render_formula_image(formula, img_path)
                    story.append(Spacer(1, 4))
                    story.append(RLImage(img_path, hAlign="LEFT"))
                    story.append(Spacer(1, 4))
                except Exception:
                    story.append(Paragraph(f"Formula: {formula}", bullet_style))

            diagram = section.get("diagram") or {}
            d_type = diagram.get("type", "none")
            try:
                if d_type == "bar" and diagram.get("labels") and diagram.get("values"):
                    img_path = os.path.join(tmp_dir, f"chart_{sec_idx}.png")
                    _render_bar_chart(diagram.get("title", heading), diagram["labels"], diagram["values"], img_path)
                    story.append(RLImage(img_path, width=4.3 * inch, height=2.2 * inch, hAlign="CENTER"))
                    story.append(Spacer(1, 8))
                elif d_type == "flow" and diagram.get("labels"):
                    img_path = os.path.join(tmp_dir, f"flow_{sec_idx}.png")
                    _render_flow_diagram(diagram.get("title", heading), diagram["labels"], img_path)
                    n = max(6, len(diagram["labels"]) * 1.7)
                    story.append(RLImage(img_path, width=5.6 * inch, height=5.6 * inch * (1.8 / n), hAlign="CENTER"))
                    story.append(Spacer(1, 8))
            except Exception:
                pass

        key_terms = notes_data.get("key_terms") or []
        if key_terms:
            story.append(Paragraph("Key Terms", heading_style))
            rows = [[Paragraph(f"<b>{kt.get('term', '')}</b>", term_style),
                     Paragraph(kt.get("definition", ""), term_style)] for kt in key_terms]
            table = Table(rows, colWidths=[1.6 * inch, 4.4 * inch])
            table.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#e0dced")),
            ]))
            story.append(table)
            story.append(Spacer(1, 10))

        exam_tips = notes_data.get("exam_tips") or []
        if exam_tips:
            story.append(Paragraph("Exam Tips", heading_style))
            items = [ListItem(Paragraph(tip, tip_style), leftIndent=10) for tip in exam_tips]
            story.append(ListFlowable(items, bulletType="bullet", start="★", leftIndent=14))

        doc = SimpleDocTemplate(
            out_path, pagesize=A4,
            leftMargin=0.75 * inch, rightMargin=0.75 * inch,
            topMargin=0.75 * inch, bottomMargin=0.75 * inch,
            title=notes_data.get("title", topic),
        )
        doc.build(story)

    return filename
