import os
import re
import pypdf
import pytesseract
from pdf2image import convert_from_path
from sentence_transformers import SentenceTransformer
import chromadb
from django.core.management.base import BaseCommand
from chatbot.models import Subject, Document

# ---- Config ----
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
POPPLER_PATH = r"C:\Users\KIIT0001\AppData\Local\Microsoft\WinGet\Packages\oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe\poppler-25.07.0\Library\bin"
ROOT_PATH = r"C:\Users\KIIT0001\OneDrive\Desktop\exam qs"
CHROMA_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "chroma_db")

print("Loading embedding model (first run downloads it, may take a minute)...")
embedder = SentenceTransformer('all-MiniLM-L6-v2')

chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
collection = chroma_client.get_or_create_collection(name="pyq_chunks")


def extract_text_from_pdf(file_path):
    try:
        reader = pypdf.PdfReader(file_path)
        full_text = ""
        for page in reader.pages:
            full_text += (page.extract_text() or "") + "\n"

        if full_text.strip():
            return full_text, "normal"

        images = convert_from_path(file_path, poppler_path=POPPLER_PATH)
        ocr_text = ""
        for img in images:
            ocr_text += pytesseract.image_to_string(img) + "\n"
        return ocr_text, "ocr"
    except Exception as e:
        return "", f"ERROR: {e}"


def extract_metadata(text):
    metadata = {"year": None, "exam_type": None}
    exam_year_match = re.search(r"EXAMINATION[-\s]*(\d{4})", text.upper())
    if exam_year_match:
        metadata["year"] = int(exam_year_match.group(1))
    else:
        year_match = re.search(r"\b(19|20)\d{2}\b", text)
        if year_match:
            metadata["year"] = int(year_match.group())

    text_upper = text.upper()
    if "MID SEMESTER" in text_upper or "MID-SEM" in text_upper or "MIDSEM" in text_upper:
        metadata["exam_type"] = "Midsem"
    elif "END SEMESTER" in text_upper or "END-SEM" in text_upper or "ENDSEM" in text_upper:
        metadata["exam_type"] = "Endsem"
    elif "SUPPLEMENTARY" in text_upper or "BACK" in text_upper:
        metadata["exam_type"] = "Supplementary"

    return metadata


def chunk_by_subquestion(text):
    pattern = r'(?:^|\n)\s*(\d{1,2})\.\s|\n\s*\(([a-j])\)\s'
    matches = list(re.finditer(pattern, text))
    chunks = []
    current_main = None

    for i, match in enumerate(matches):
        main_num, sub_letter = match.groups()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        chunk_text = text[start:end].strip()

        if main_num:
            current_main = main_num
            if chunk_text and not chunk_text.startswith("(") and len(chunk_text) > 15:
                chunks.append({"question_number": f"{current_main}", "text": chunk_text})
        elif sub_letter and current_main:
            if len(chunk_text) > 10:
                chunks.append({"question_number": f"{current_main}({sub_letter})", "text": chunk_text})

    if not chunks and text.strip():
        chunks.append({"question_number": "full", "text": text.strip()})

    return chunks


class Command(BaseCommand):
    help = "Ingest PYQs and syllabus files into ChromaDB + Django DB"

    def handle(self, *args, **options):
        stats = {"subjects": 0, "pyq_files": 0, "syllabus_files": 0, "chunks": 0, "skipped": 0, "errors": 0}

        for semester in sorted(os.listdir(ROOT_PATH)):
            semester_path = os.path.join(ROOT_PATH, semester)
            if not os.path.isdir(semester_path):
                continue

            for subject_name in sorted(os.listdir(semester_path)):
                subject_path = os.path.join(semester_path, subject_name)
                if not os.path.isdir(subject_path):
                    continue

                subject_obj, _ = Subject.objects.get_or_create(name=subject_name, semester=semester)
                stats["subjects"] += 1
                self.stdout.write(f"\n=== {semester} / {subject_name} ===")

                syllabus_path = os.path.join(subject_path, "syllabus.txt")
                if os.path.exists(syllabus_path):
                    with open(syllabus_path, "r", encoding="utf-8", errors="ignore") as f:
                        syllabus_text = f.read()

                    doc_obj, created = Document.objects.get_or_create(
                        subject=subject_obj, doc_type="syllabus", file_name="syllabus.txt",
                        defaults={"source_path": syllabus_path}
                    )
                    if created:
                        embedding = embedder.encode(syllabus_text).tolist()
                        chroma_id = f"syllabus_{subject_obj.id}"
                        collection.upsert(
                            ids=[chroma_id],
                            embeddings=[embedding],
                            documents=[syllabus_text],
                            metadatas=[{
                                "subject": subject_name, "semester": semester,
                                "doc_type": "syllabus", "question_number": "full"
                            }]
                        )
                        stats["syllabus_files"] += 1

                for fname in sorted(os.listdir(subject_path)):
                    if fname == "syllabus.txt":
                        continue
                    fpath = os.path.join(subject_path, fname)
                    ext = os.path.splitext(fname)[1].lower()

                    if ext != ".pdf":
                        self.stdout.write(f"  - {fname} [skipped: {ext} not yet supported]")
                        stats["skipped"] += 1
                        continue

                    if Document.objects.filter(subject=subject_obj, file_name=fname, doc_type="pyq").exists():
                        self.stdout.write(f"  - {fname} [already ingested, skipping]")
                        continue

                    text, method = extract_text_from_pdf(fpath)
                    if not text.strip():
                        self.stdout.write(f"  - {fname} [FAILED: no text extracted]")
                        stats["errors"] += 1
                        continue

                    meta = extract_metadata(text)
                    chunks = chunk_by_subquestion(text)

                    doc_obj = Document.objects.create(
                        subject=subject_obj, doc_type="pyq", file_name=fname,
                        exam_type=meta["exam_type"], year=meta["year"], source_path=fpath
                    )

                    for chunk in chunks:
                        embedding = embedder.encode(chunk["text"]).tolist()
                        chroma_id = f"pyq_{doc_obj.id}_{chunk['question_number']}"
                        collection.upsert(
                            ids=[chroma_id],
                            embeddings=[embedding],
                            documents=[chunk["text"]],
                            metadatas=[{
                                "subject": subject_name, "semester": semester,
                                "doc_type": "pyq", "question_number": chunk["question_number"],
                                "year": meta["year"] or 0, "exam_type": meta["exam_type"] or "Unknown",
                                "file_name": fname
                            }]
                        )
                        stats["chunks"] += 1

                    stats["pyq_files"] += 1
                    self.stdout.write(f"  - {fname} [{method}] -> {len(chunks)} chunks | {meta}")

        self.stdout.write(self.style.SUCCESS(f"\n\n=== DONE ==="))
        self.stdout.write(self.style.SUCCESS(f"Subjects: {stats['subjects']}"))
        self.stdout.write(self.style.SUCCESS(f"Syllabus files ingested: {stats['syllabus_files']}"))
        self.stdout.write(self.style.SUCCESS(f"PYQ files ingested: {stats['pyq_files']}"))
        self.stdout.write(self.style.SUCCESS(f"Total chunks stored: {stats['chunks']}"))
        self.stdout.write(self.style.WARNING(f"Skipped (docx/doc): {stats['skipped']}"))
        self.stdout.write(self.style.ERROR(f"Errors: {stats['errors']}"))