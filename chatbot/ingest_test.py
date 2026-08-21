import os
import re
import pypdf
import pytesseract
from pdf2image import convert_from_path

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
POPPLER_PATH = r"C:\Users\KIIT0001\AppData\Local\Microsoft\WinGet\Packages\oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe\poppler-25.07.0\Library\bin"

ROOT_PATH = r"C:\Users\KIIT0001\OneDrive\Desktop\exam qs"


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


def walk_pyq_folder(root_path):
    results = []

    for semester in sorted(os.listdir(root_path)):
        semester_path = os.path.join(root_path, semester)
        if not os.path.isdir(semester_path):
            continue

        for subject in sorted(os.listdir(semester_path)):
            subject_path = os.path.join(semester_path, subject)
            if not os.path.isdir(subject_path):
                continue

            print(f"\n=== {semester} / {subject} ===")

            # Handle syllabus.txt
            syllabus_path = os.path.join(subject_path, "syllabus.txt")
            if os.path.exists(syllabus_path):
                print("  [syllabus.txt found]")
            else:
                print("  [!] No syllabus.txt found")

            # Handle each file
            for fname in sorted(os.listdir(subject_path)):
                if fname == "syllabus.txt":
                    continue
                fpath = os.path.join(subject_path, fname)
                ext = os.path.splitext(fname)[1].lower()

                if ext == ".pdf":
                    text, method = extract_text_from_pdf(fpath)
                    meta = extract_metadata(text)
                    status = "OK" if text.strip() else "EMPTY/FAILED"
                    print(f"  - {fname} | method={method} | {meta} | {status}")
                elif ext == ".docx":
                    print(f"  - {fname} | [DOCX - not yet handled]")
                elif ext == ".doc":
                    print(f"  - {fname} | [OLD DOC FORMAT - not yet handled]")
                else:
                    print(f"  - {fname} | [unknown file type: {ext}]")

    return results


if __name__ == "__main__":
    walk_pyq_folder(ROOT_PATH)