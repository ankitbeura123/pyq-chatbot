# 🌌 Orchids / Observatory — KIIT PYQ AI Assistant & Exam Intelligence Platform

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg?style=flat-square&logo=python)](https://python.org)
[![Django](https://img.shields.io/badge/Django-5.x-092E20.svg?style=flat-square&logo=django)](https://djangoproject.com)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg?style=flat-square&logo=react)](https://reactjs.org)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF.svg?style=flat-square&logo=vite)](https://vitejs.dev)
[![KaTeX](https://img.shields.io/badge/Math-KaTeX-11AC84.svg?style=flat-square&logo=latex)](https://katex.org)
[![ChromaDB](https://img.shields.io/badge/Vector%20DB-ChromaDB-FF6B6B.svg?style=flat-square)](https://trychroma.com)
[![Google Gemini](https://img.shields.io/badge/AI%20Engine-Google%20Gemini-8E75B2.svg?style=flat-square&logo=google)](https://ai.google.dev)
[![ReportLab](https://img.shields.io/badge/PDF-ReportLab%20%2B%20Matplotlib-E05D44.svg?style=flat-square)](https://www.reportlab.com)

**Orchids** (Observatory) is a comprehensive, production-grade AI Exam Preparation and Academic Intelligence Platform built specifically for university students at **KIIT (Kalinga Institute of Industrial Technology)**. It indexes years of Previous Year Question (PYQ) papers and official course syllabi into a persistent vector database (ChromaDB) and relational metadata store (SQLite).

Beyond basic question search, Orchids provides **grounded multi-model AI reasoning**, **syllabus-aligned unit and topic analytics**, an **interactive weighted score predictor**, an **AI-powered MCQ quiz generator**, a **full-fledged University Mock Exam Generator with dual LaTeX-styled Question Paper & Solution PDF downloads**, and a **fast in-browser document reader & PDF streamer**.

---

## 🌟 Key Features & Capabilities

### 1. 📑 AI Mock Exam Generator (Midsem & Endsem) — *New!*
- **Syllabus Scoping Logic**:
  - **Midsem Exam (Total: 20 Marks | 1.5 Hours)**: Automatically scopes questions strictly to the **first half of the course syllabus** (e.g., 3 of 6 units, or 2.5 of 5 units).
  - **Endsem Exam (Total: 50 Marks | 3.0 Hours)**: Scoped across the **entire course syllabus** (100% of all units & topics).
- **Exact University Examination Blueprint**:
  - **Midsem Structure**:
    - **Q.1 (Compulsory)**: 5 sub-questions of 1 mark each = **5 Marks**.
    - **Q.2 to Q.5 (Long Questions)**: 4 questions of 5 marks each (with sub-parts (a) and (b) summing to 5 marks). Student answers any **3** out of Q.2–Q.5 (1 choice question) = **15 Marks**.
    - **Total Exam Marks**: $5 + (3 \times 5) = 20\text{ Marks}$.
  - **Endsem Structure**:
    - **Q.1 (Compulsory)**: 10 sub-questions of 1 mark each = **10 Marks**.
    - **Q.2 to Q.7 (Long Questions)**: 6 questions of 10 marks each (with sub-parts summing to 10 marks). Student answers any **4** out of Q.2–Q.7 (2 choice questions) = **40 Marks**.
    - **Total Exam Marks**: $10 + (4 \times 10) = 50\text{ Marks}$.
- **Authentic Dual PDF Compilation**:
  - 📄 **Question Paper PDF**: Clean, official examination layout with university headers, course codes, time limits, double rule dividers, right-aligned mark brackets `[5]`, and choices.
  - 📝 **Answer Key & Marking Scheme PDF**: Step-by-step solutions, key conceptual explanations, formulas, and point-by-point marking rubrics.
- **True LaTeX Math & Equations**:
  - **In-Browser Preview**: Rendered using **KaTeX** (`<MathRenderer />`) supporting inline math (`$...$`) and block equations (`$$...$$`).
  - **In-PDF Vector/Raster Equations**: Matplotlib mathtext rasterizer with exact physical point scaling (`px * 72 / DPI`) to prevent oversized equations and guarantee crisp print quality.

### 2. 💬 Grounded RAG AI Assistant
- Powered by **Google Gemini** (`gemini-3.5-flash-lite`, `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-flash-latest`) and **ChromaDB** vector similarity search.
- Provides step-by-step conceptual explanations, mathematical derivations, historical question trends, and exam predictions with explicit source citations (Year, Exam Type, Question Number).
- Supports natural language intent and filter extraction (e.g., *"Show me Q.3(a) from 2023 Endsem"*).

### 3. 📊 Knowledge Discovery & Syllabus Intelligence
- Aggregates historical question distributions across course units and syllabus topics.
- Visual charts and frequency matrices highlight high-yield units and recurring exam themes.

### 4. 🎯 Weighted Score Predictor
- Calculates expected exam scores based on historical topic mark weights.
- Interactive topic checklist lets students select what they have prepared and instantly see predicted marks and preparedness percentages.

### 5. 📝 AI MCQ Quiz Generator & Evaluator
- Generates topic-targeted multiple-choice quizzes with 4 options, automated grading, instant feedback, and detailed conceptual rationales.

### 6. 📚 Semester & Subject Document Catalog
- Browse past papers organized by semester with real-time statistics (paper counts, year ranges, exam session badges).
- Extracted plain-text reader view and direct raw PDF streaming downloads.

### 7. 🎨 Cosmic Glassmorphic Interface
- React 18 Single Page Application with animated starfield background, glowing glassmorphic cards, modern typography, responsive design, and smooth transitions.

### 8. 🛡️ Fault Tolerance & Multi-Model Resilience
- Centralized Gemini client with automatic 429 quota backoff, exponential retry delays, JS comment stripping, LaTeX backslash escape repair, and multi-model fallback.

---

## 🏗️ System Architecture

```
                                  +---------------------------------------+
                                  |       KIIT Syllabus & PYQ PDFs        |
                                  +---------------------------------------+
                                                      |
                                                      v
                                  +---------------------------------------+
                                  |      INGESTION & OCR PIPELINE         |
                                  | (PyPDF, Tesseract OCR, Poppler)       |
                                  +---------------------------------------+
                                           |                         |
                                           v                         v
                         +-------------------+             +-------------------+
                         | Sub-question RegEx|             |  Syllabus Parser  |
                         |    Chunking       |             |   (Gemini JSON)   |
                         +-------------------+             +-------------------+
                                   |                                 |
                                   v                                 v
                         +-------------------+             +-------------------+
                         |SentenceTransformer|             |   Unit & Topic    |
                         | (all-MiniLM-L6-v2)|             |  Auto-Classifier  |
                         +-------------------+             +-------------------+
                                   |                                 |
                                   +----------------+----------------+
                                                    |
                                                    v
                                 +-------------------------------------+
                                 |         PERSISTENT STORAGE          |
                                 |  - ChromaDB (384-dim Embeddings)    |
                                 |  - SQLite (Metadata & Subjects)     |
                                 +-------------------------------------+
                                                    |
                   +--------------------------------+--------------------------------+
                   |                                |                                |
                   v                                v                                v
     +---------------------------+    +---------------------------+    +---------------------------+
     |      RAG CHAT ENGINE      |    |    KNOWLEDGE DISCOVERY    |    |      SCORE PREDICTOR      |
     | - Query Filter Parser     |    | - Unit & Topic Aggregation|    | - Topic Weight Matrix     |
     | - ChromaDB Vector Search  |    | - Question Frequency Maps |    | - Coverage Percentage     |
     | - Gemini Multi-Model LLM  |    | - Syllabus Distributions  |    | - Predicted Marks / Total |
     +---------------------------+    +---------------------------+    +---------------------------+
                   |                                |                                |
                   +--------------------------------+--------------------------------+
                                                    |
                   +--------------------------------+--------------------------------+
                   |                                                                 |
                   v                                                                 v
     +---------------------------+                                     +---------------------------+
     |      QUIZ GENERATOR       |                                     |    MOCK EXAM GENERATOR    |
     | - Strict JSON MCQ Schema  |                                     | - Midsem (20M) / Endsem(50)|
     | - Validated Options/Keys  |                                     | - First-Half Syllabus Map |
     | - Instant Grading Engine  |                                     | - Matplotlib LaTeX Math   |
     | - Syllabus Grounding      |                                     | - Dual PDF Builder (QP/Ans)|
     +---------------------------+                                     +---------------------------+
                                                    |
                                                    v
                                 +-------------------------------------+
                                 |          REACT 18 + VITE UI         |
                                 |   (KaTeX Math, Glassmorphism CSS)   |
                                 +-------------------------------------+
```

---

## 📁 Complete File Structure

```
pyq-chatbot/
│
├── .env                                # Environment variables (GEMINI_API_KEY)
├── .gitignore                          # Git ignore rules (venv, dist, DBs, mock_papers)
├── manage.py                           # Django CLI administrative entry point
├── requirements.txt                    # Python dependencies specification
├── run.bat                             # One-click Windows fast launcher (venv auto-detect + browser)
├── start_server.bat                    # Shortcut wrapper executing run.bat
├── db.sqlite3                          # Relational SQLite database (Subjects, Documents, Messages)
├── README.md                           # Master project documentation
│
├── diagnose_subject.py                 # Diagnostic utility to inspect syllabus cache & untagged chunks
├── review_tags.py                      # Tag quality audit script (flags subjects with >15% unclassified chunks)
├── retag_flagged.py                    # Batch re-tagging automation script for flagged subjects
│
├── chroma_db/                          # Persistent ChromaDB vector database directory
│   ├── chroma.sqlite3                  # ChromaDB internal metadata and collection indices
│   └── ...                             # 384-dim vector embeddings and segment storage
│
├── syllabus_cache/                     # Local JSON cache of parsed syllabus structures
│   └── <subject_name>.json             # Structured units and topic lists generated by Gemini
│
├── mock_papers/                        # Generated examination PDF documents directory
│   ├── mock_qp_<subject>_<id>.pdf      # Exported Question Paper PDFs (clean exam layout)
│   └── mock_ans_<subject>_<id>.pdf     # Exported Answer Key & Marking Scheme PDFs
│
├── revision_notes/                     # Legacy generated revision notes PDF cache
│
├── examprep/                           # Django Project Configuration Package
│   ├── __init__.py                     # Package indicator
│   ├── asgi.py                         # ASGI entry point for async servers
│   ├── settings.py                     # Main project settings (Apps, Templates, Staticfiles, DB)
│   ├── urls.py                         # Root URL dispatcher (delegates to chatbot.urls)
│   └── wsgi.py                         # WSGI entry point for web deployment
│
├── chatbot/                            # Core Application Package (Backend & Business Logic)
│   ├── __init__.py                     # App package indicator
│   ├── admin.py                        # Django Admin model registrations
│   ├── analytics.py                    # Analytics aggregation, topic frequencies & score prediction math
│   ├── apps.py                         # Django App configuration (ChatbotConfig)
│   ├── gemini_utils.py                 # Multi-model Gemini client, rate-limiter, comment stripper & 429 retry backoff
│   ├── mock_engine.py                  # University Mock Exam engine, LaTeX formula scaler & dual PDF compiler
│   ├── models.py                       # ORM Models (Subject, Document, ChatMessage)
│   ├── notes_engine.py                 # Revision notes engine & PDF builder
│   ├── quiz_engine.py                  # AI MCQ Quiz generation and validation engine
│   ├── rag.py                          # RAG pipeline, ChromaDB retrieval, filter extractors, Gemini chat
│   ├── syllabus_parser.py              # Syllabus extraction from ChromaDB & Gemini JSON structuring
│   ├── tests.py                        # Unit testing module
│   ├── urls.py                         # API routes and catch-all React SPA routing
│   ├── views.py                        # HTTP/JSON request handlers & React SPA index distributor
│   │
│   ├── management/                     # Custom Django management commands
│   │   ├── __init__.py
│   │   └── commands/
│   │       ├── __init__.py
│   │       ├── ingest_pyqs.py          # Batch PDF ingestion, OCR, subquestion chunking & ChromaDB indexing
│   │       └── tag_units_topics.py     # LLM-based batch classification of PYQ chunks to syllabus topics
│   │
│   └── migrations/                     # Django database migrations
│       ├── __init__.py
│       └── 0001_initial.py             # Schema definition for Subject, Document, ChatMessage
│
└── frontend/                           # Modern React 18 + Vite Single Page Application (SPA)
    ├── package.json                    # Node dependencies (KaTeX, Marked, D3, Lucide) and build scripts
    ├── package-lock.json               # Locked dependency tree
    ├── vite.config.js                  # Vite bundler configuration (proxy to Django API & static base)
    ├── index.html                      # Single page HTML entry point with Google Fonts
    │
    ├── dist/                           # Compiled production frontend assets (served by Django)
    │   ├── index.html                  # Built SPA HTML template
    │   └── assets/                     # Bundled JS, CSS, and KaTeX font static assets
    │
    └── src/                            # React application source code
        ├── main.jsx                    # React DOM entry point & Router configuration
        ├── App.jsx                     # Top-level routing layout (TopBar + Page Routes)
        ├── index.css                   # Global CSS design tokens, glassmorphism styles & animations
        ├── quiz.css                    # Specialized styles for interactive quiz cards, timer & scorecard
        ├── mock.css                    # Specialized styles for Mock Exam sheet, section dividers & formula cards
        ├── notes.css                   # Styles for revision notes
        │
        ├── components/                 # Reusable UI Components
        │   ├── CosmicBackground.jsx    # Cosmic canvas background
        │   ├── CustomSelect.css        # Styles for dropdown component
        │   ├── CustomSelect.jsx        # Accessible custom dropdown component
        │   ├── LandingShowcase.jsx     # Visual preview component for landing page
        │   ├── MathRenderer.jsx        # KaTeX-powered LaTeX renderer for inline ($...$) and block ($$...$$) math
        │   ├── OrchidsBackground.jsx   # Ambient gradient background
        │   └── TopBar.jsx              # Navigation bar with active route highlighting
        │
        └── pages/                      # Application Page Views
            ├── HomePage.jsx            # Landing page showcasing platform features and quick CTA links
            ├── ChatPage.jsx            # Interactive AI Chat assistant with subject filter & markdown
            ├── MockExamPage.jsx        # Mock Exam Generator with live syllabus preview & dual PDF downloads
            ├── KnowledgeDiscoveryPage.jsx # Unit & topic frequency visual charts and statistics
            ├── ScorePredictorPage.jsx  # Interactive topic checklist and weighted score prediction
            ├── QuizPage.jsx            # Interactive card-based MCQ quiz generator & evaluator
            ├── BrowseSubjectsPage.jsx  # Semester-categorized subject catalog
            ├── BrowseDocumentsPage.jsx # Subject document list with preview/download actions
            ├── ViewDocumentPage.jsx    # Clean reader view displaying extracted question text
            └── RevisionNotesPage.jsx   # Revision notes interface
```

---

## 🔍 Detailed Module & Component Breakdown

### 1. Mock Exam Generator (`chatbot/mock_engine.py` & `frontend/src/pages/MockExamPage.jsx`)
- **Syllabus Scope Determination (`get_exam_syllabus_scope`)**:
  - Calculates unit coverage: for **Midsem**, takes $\lceil N/2 \rceil$ units (or splits single long units proportionally); for **Endsem**, takes $100\%$ of units.
- **Syllabus-Grounded Few-Shot Synthesis**:
  - Retrieves real historical PYQ chunks from ChromaDB for the selected subject as stylistic few-shot examples.
  - Formulates a structured Gemini prompt enforcing university question patterns, difficulty balancing, and pure JSON output.
- **Matplotlib Math Scaler (`_render_formula_image`)**:
  - Converts LaTeX equations (`\frac{...}{...}`, `\int`, `\sigma`, `\nabla`) into high-resolution transparent PNG images using Matplotlib mathtext.
  - Automatically computes true physical point dimensions (`points = pixels * 72 / DPI`) so equations render at natural reading size (10.5pt equivalent) inside ReportLab PDFs.
- **Dual ReportLab PDF Builder (`build_exam_pdf`)**:
  - Generates two separate A4 documents using `SimpleDocTemplate`:
    1. **Question Paper**: Clean layout with university header, branch, semester, course title, duration, total marks, instructions, Q.1 compulsory table, and long question sections with right-aligned marks.
    2. **Answer Key**: Includes all questions followed by step-by-step mathematical working, key points, final answers, and explicit marking schemes (e.g. `[1 Mark for Formula, 2 Marks for Substitution, 2 Marks for Final Answer]`).
- **KaTeX Web Preview (`frontend/src/components/MathRenderer.jsx`)**:
  - Parses mixed text, inline math (`$...$`), display math (`$$...$$`), and explicit `formula` fields, rendering crisp vector equations directly in the DOM.

### 2. RAG Chat Engine (`chatbot/rag.py` & `frontend/src/pages/ChatPage.jsx`)
- **Query Filter Parser**: Uses regex pattern matchers to detect temporal intents (e.g. `2018` to `2024`), exam sessions (`Midsem`, `Endsem`, `Supplementary`), and question indices (`Q.1`, `Q.4(b)`).
- **Hybrid Retrieval**: Combines metadata filtering with ChromaDB cosine similarity search over 384-dimensional `all-MiniLM-L6-v2` dense embeddings.
- **Context Synthesis**: Feeds top-k chunks with syllabus context to Google Gemini to formulate structured, cited responses.

### 3. Analytics & Score Predictor (`chatbot/analytics.py` & `frontend/src/pages/ScorePredictorPage.jsx`)
- Aggregates chunk tags to compute relative frequency and expected marks for every topic in a course syllabus.
- Formula for topic weight $W_i$:
  $$W_i = \frac{\text{Count}(T_i)}{\sum_{j} \text{Count}(T_j)}$$
- Formula for predicted student score given studied topic set $S$:
  $$\text{Predicted Score} = \text{Total Marks} \times \sum_{i \in S} W_i$$

### 4. Resilient Gemini Client (`chatbot/gemini_utils.py`)
- Centralized invocation layer across Gemini models (`gemini-3.5-flash-lite`, `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-flash-latest`).
- **Rate-Limiting & Backoff**: Handles HTTP 429 quota exhaustion with exponential backoff and randomized jitter.
- **JSON Sanitization**: Strips JavaScript-style comments (`// ...`) and repairs unescaped single backslashes in LaTeX strings (`\frac`, `\alpha`, `\sum`) prior to `json.loads`.

---

## 🌐 Complete REST API Reference

| Endpoint | Method | Request Payload / Query Params | Response Structure | Description |
| :--- | :--- | :--- | :--- | :--- |
| **`/api/subjects/`** | `GET` | — | `{"semesters": [...], "subjects_by_semester": {...}, "all_subjects": [...]}` | Lists all indexed subjects grouped by semester. |
| **`/api/chat/`** | `POST` | `{"message": "...", "subject": "..."}` | `{"response": "..."}` | Queries RAG chat assistant with vector retrieval and citation grounding. |
| **`/api/browse/`** | `GET` | `?sem=3rd%20Semester` | `{"subjects_data": [...], "semesters": [...], "selected_sem": "..."}` | Returns subject cards with paper counts, year ranges, and exam types. |
| **`/api/browse/subject/<id>/`** | `GET` | — | `{"subject": {...}, "documents": [...], "syllabus": {...}, "count": 12}` | Lists all PYQ documents and syllabus for a given subject. |
| **`/api/browse/document/<id>/`** | `GET` | — | `{"id": 1, "text": "...", "file_name": "..."}` | Fetches extracted plain-text preview of an exam document. |
| **`/browse/document/<id>/download/`** | `GET` | — | `FileResponse (application/pdf)` | Streams the original raw PDF file from disk. |
| **`/browse/subject/<id>/syllabus/download/`** | `GET` | — | `FileResponse (text/plain)` | Downloads the raw syllabus text file for a subject. |
| **`/api/discover/<subject_id>/`** | `GET` | — | `{"subject": "...", "units": [...], "total_questions": 142}` | Returns question count distributions grouped by unit and topic. |
| **`/api/predict/topics/<subject_id>/`** | `GET` | — | `{"topics": [{"id": 1, "name": "...", "unit": "...", "percentage": 14.2}]}` | Returns syllabus topics with historical frequency percentages. |
| **`/api/predict/score/`** | `POST` | `{"subject_id": 1, "studied_topics": [1, 3, 5], "total_marks": 50}` | `{"predicted_score": 38.5, "percentage": 77.0, "total_marks": 50, "breakdown": [...]}` | Computes weighted score prediction based on selected topics. |
| **`/api/quiz/generate/`** | `POST` | `{"topic_description": "...", "num_questions": 10}` | `{"quiz": {"title": "...", "questions": [{"question": "...", "options": [...], "answer": "...", "explanation": "..."}]}}` | Generates topic-targeted MCQ quiz with validated keys. |
| **`/api/mock/syllabus-preview/`** | `GET` | `?subject_id=1&exam_type=midsem` | `{"subject": "...", "exam_type": "midsem", "scope": {"units": [...], "unit_count": 3, "total_units": 6}}` | Returns syllabus units and topics included in the selected exam type. |
| **`/api/mock/generate/`** | `POST` | `{"subject_id": 1, "exam_type": "midsem"}` | `{"success": true, "paper": {...}, "qp_filename": "mock_qp_....pdf", "ans_filename": "mock_ans_....pdf"}` | Generates mock paper JSON and compiles Question Paper & Solution PDFs. |
| **`/mock/download/<filename>/`** | `GET` | — | `FileResponse (application/pdf)` | Streams a generated Question Paper or Solution PDF file. |

---

## 🚀 Setup & Installation Guide

### 1. Prerequisites
- **Python**: Version 3.10 or higher
- **Node.js**: Version 18 or higher (for building the React frontend)
- **Tesseract OCR** *(Optional, required only for ingesting scanned/image PDFs)*:
  - Install at `C:\Program Files\Tesseract-OCR\tesseract.exe`
- **Poppler** *(Optional, required for converting PDF pages to images for OCR)*

### 2. Clone & Environment Setup
```bash
# Clone the repository
git clone https://github.com/your-username/pyq-chatbot.git
cd pyq-chatbot

# Create virtual environment
python -m venv venv

# Activate virtual environment (Windows)
venv\Scripts\activate

# Activate virtual environment (macOS/Linux)
# source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

### 3. Configure Environment Secrets
Create a `.env` file in the project root:
```env
GEMINI_API_KEY=your_google_gemini_api_key_here
```

### 4. Build Frontend Assets
```bash
# Navigate to frontend folder
cd frontend

# Install dependencies (React, KaTeX, Lucide, D3, Marked)
npm install

# Build production bundle (compiles to frontend/dist)
npm run build

# Return to root directory
cd ..
```

### 5. Initialize Database & Run Ingestion Pipeline
```bash
# Apply Django migrations to initialize SQLite
python manage.py migrate

# Ingest PYQ PDFs and syllabus files into ChromaDB & SQLite
python manage.py ingest_pyqs

# Tag question chunks with syllabus units & topics using LLM
python manage.py tag_units_topics
```

---

## 🏃 Running the Application

### Option A: One-Click Windows Launcher (Recommended)
Simply double-click or run:
```bash
run.bat
```
*This script checks your virtual environment, runs `npm run build` in `frontend/`, opens `http://127.0.0.1:8000/` in your default browser, and starts the Django server.*

### Option B: Standard Django CLI
```bash
python manage.py runserver 127.0.0.1:8000
```
Open `http://127.0.0.1:8000/` in your browser.

### Option C: Concurrent Development Mode (Vite Hot-Reload)
For live frontend UI tweaking with instant hot-reloading:
```bash
# Terminal 1: Django Backend API
python manage.py runserver 127.0.0.1:8000

# Terminal 2: Vite Dev Server
cd frontend
npm run dev
```
Open `http://localhost:5173/` (Vite dev server automatically proxies all `/api`, `/mock/download`, and `/browse` requests to `http://127.0.0.1:8000`).

---

## 🛠️ Diagnostics & Maintenance Tools

| Script | Command | Purpose |
| :--- | :--- | :--- |
| **`diagnose_subject.py`** | `python diagnose_subject.py "<Subject Name>"` | Inspects syllabus cache and lists unclassified PYQ chunks for a subject. |
| **`review_tags.py`** | `python review_tags.py` | Audits classification health across all subjects in ChromaDB and flags subjects with $>15\%$ unclassified chunks. |
| **`retag_flagged.py`** | `python retag_flagged.py` | Automatically runs `tag_units_topics --force` sequentially for all flagged subjects. |

---

## 💻 Tech Stack Summary

- **Backend Framework**: Python 3.10+, Django 5.x
- **Frontend Architecture**: React 18, Vite 5, React Router 6, Vanilla CSS (Glassmorphism & Cosmic tokens)
- **Math & LaTeX Rendering**: KaTeX (Client-side Web) & Matplotlib mathtext (Server-side PDF point-scaled rasterizer)
- **Vector Database**: ChromaDB (Persistent Disk Storage)
- **Embeddings**: `sentence-transformers/all-MiniLM-L6-v2` (384-dimensional dense vectors)
- **Generative AI LLM**: Google Gemini API (`gemini-3.5-flash-lite`, `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-flash-latest`)
- **PDF Generation Engine**: ReportLab (Flowable tables, keepWithNext headers, paragraph styles)
- **Document & OCR Ingestion**: PyPDF, Tesseract-OCR, PDF2Image, Poppler
- **Relational Storage**: SQLite3

---

## 📄 License
This project is licensed under the MIT License — feel free to use and extend for academic and research purposes.
