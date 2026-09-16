# 🌌 Observatory — KIIT PYQ AI Assistant & Exam Intelligence Platform

**Observatory** is an end-to-end, AI-powered Exam Preparation and Intelligence System built specifically for KIIT students. It indexes Previous Year Question (PYQ) papers and official course syllabi into a persistent vector database (ChromaDB) and relational metadata store (SQLite).

Beyond conventional question search, Observatory provides **grounded multi-model AI reasoning**, **syllabus-aligned unit/topic knowledge discovery**, an **interactive weighted score predictor**, an **AI-powered MCQ quiz generator**, an **AI revision notes engine with LaTeX formula/diagram PDF rendering**, and a **fast document browser/previewer**.

---

## 🌟 Key Features

- 💬 **Grounded RAG AI Assistant**: Powered by Google Gemini (`gemini-3.5-flash-lite`, `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-flash-latest`) and ChromaDB vector search. Delivers step-by-step mathematical/conceptual solutions, question trends, and exam predictions with explicit source citations.
- 🎯 **Smart Query Filter Extraction**: Regex-based natural language intent parser that extracts years (e.g., `2019`, `2023`), exam sessions (`Midsem`, `Endsem`, `Supplementary`), and subquestion numbers (`Q.2(b)`) to execute precision filtered searches before falling back to semantic similarity.
- 📊 **Knowledge Discovery & Syllabus Intelligence**: Aggregates question distributions across course units and syllabus topics with dynamic visual charts and frequency rankings.
- 🎯 **Weighted Score Predictor**: Calculates an expected exam score based on historical topic frequencies and the specific topics the student has studied, providing topic-by-topic mark contribution breakdowns.
- 📝 **AI MCQ Quiz Generator & Evaluator**: Generates topic-targeted multiple-choice quizzes with 4 options, automated scoring, instant answer feedback, and detailed conceptual explanations.
- 📘 **AI Revision Notes & PDF Generator**: Automatically drafts structured, comprehensive exam revision notes on any topic, complete with rendered Matplotlib LaTeX formulas, process/flow diagrams, key terminology tables, exam tips, and downloadable PDFs (via ReportLab).
- 📚 **Semester & Subject Document Catalog**: Browse past papers organized by semester with real-time statistics (paper counts, year spans, exam session badges).
- 📄 **In-Browser Document Reader & PDF Streaming**: Instant plain-text preview extracted from PDFs with direct one-click raw PDF downloads.
- 🎨 **Cosmic Glassmorphic Interface**: High-aesthetic React 18 SPA featuring an animated HTML5 starfield background, glowing cards, modern typography, responsive design, and Markdown formatting with marked.js.
- 🛡️ **Robust Rate-Limiting & Model Fallback**: Built-in 429 quota handling, automatic retry delays, request throttling, and multi-model fallback logic.

---

## 🏗️ Architecture & Data Pipelines

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
    |      QUIZ GENERATOR       |                                     |    REVISION NOTES ENGINE  |
    | - Strict JSON MCQ Schema  |                                     | - Matplotlib LaTeX Math   |
    | - Validated Options/Keys  |                                     | - ReportLab PDF Builder   |
    | - Instant Grading Engine  |                                     | - Diagrams & Key Terms    |
    +---------------------------+                                     +---------------------------+
                                                   |
                                                   v
                                +-------------------------------------+
                                |          REACT 18 + VITE UI         |
                                | (Cosmic Starfield, Glassmorphism)   |
                                +-------------------------------------+
```

---

## 📁 Complete File Structure

```
pyq-chatbot/
│
├── .env                                # Environment variables configuration (GEMINI_API_KEY)
├── .gitignore                          # Git ignore specifications (venv, node_modules, dist, DBs, revision_notes)
├── manage.py                           # Django CLI administrative entry point
├── requirements.txt                    # Python dependencies specification (Django, ChromaDB, ReportLab, Matplotlib, etc.)
├── run.bat                             # One-click Windows fast launcher script (venv auto-detect & browser open)
├── start_server.bat                    # Shortcut wrapper executing run.bat
├── db.sqlite3                          # Relational SQLite database (Metadata, Subjects, Documents, Logs)
├── README.md                           # Master project documentation
│
├── diagnose_subject.py                 # Diagnostic tool to inspect syllabus cache & unclassified chunks
├── review_tags.py                      # Tag quality audit tool (flags subjects with >15% unclassified chunks)
├── retag_flagged.py                    # Batch re-tagging script for flagged subjects
│
├── chroma_db/                          # Persistent ChromaDB vector database directory
│   ├── chroma.sqlite3                  # ChromaDB internal metadata and collection indices
│   └── ...                             # Vector embeddings and segment storage
│
├── syllabus_cache/                     # Local JSON cache of parsed syllabus structures
│   └── <subject_name>.json             # Structured units and topic lists generated by Gemini
│
├── revision_notes/                     # Generated revision notes PDF documents cache
│   └── <topic_name>_<uuid>.pdf         # Exported PDF revision sheets with formulas and charts
│
├── examprep/                           # Django Project Configuration Package
│   ├── __init__.py                     # Package indicator
│   ├── asgi.py                         # ASGI entry point for async servers
│   ├── settings.py                     # Main project settings (Installed Apps, Templates, Staticfiles, DB)
│   ├── urls.py                         # Root URL configuration (delegates to chatbot.urls)
│   └── wsgi.py                         # WSGI entry point for web deployment
│
├── chatbot/                            # Core Application Package (Backend & Business Logic)
│   ├── __init__.py                     # App package indicator
│   ├── admin.py                        # Django Admin model registrations
│   ├── analytics.py                    # Analytics aggregation, topic frequencies & score prediction math
│   ├── apps.py                         # Django App configuration (ChatbotConfig)
│   ├── gemini_utils.py                 # Multi-model Gemini client, rate-limiter & 429 retry backoff
│   ├── models.py                       # ORM Models (Subject, Document, ChatMessage)
│   ├── notes_engine.py                 # AI Revision Notes generator, LaTeX formula/diagram renderer & PDF builder
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
    ├── package.json                    # Node dependencies and build scripts
    ├── package-lock.json               # Locked dependency tree
    ├── vite.config.js                  # Vite bundler configuration (proxy to Django API & static base)
    ├── index.html                      # Single page HTML entry point with Google Fonts
    │
    ├── dist/                           # Compiled production frontend assets (served by Django)
    │   ├── index.html                  # Built SPA HTML template
    │   └── assets/                     # Bundled JS and CSS static assets
    │
    └── src/                            # React application source code
        ├── main.jsx                    # React DOM entry point & Router configuration
        ├── App.jsx                     # Top-level routing layout (CosmicBackground + TopBar + Page Routes)
        ├── index.css                   # Global CSS design tokens, glassmorphism styles & animations
        ├── quiz.css                    # Specialized styles for interactive quiz cards, timer & scorecard
        ├── notes.css                   # Specialized styles for revision notes form, formula blocks & terms table
        │
        ├── components/                 # Reusable UI Components
        │   ├── CosmicBackground.jsx    # Animated HTML5 canvas background with twinkling star particles
        │   └── TopBar.jsx              # Celestial navigation bar with routing links & active state
        │
        └── pages/                      # Application Page Views
            ├── ChatPage.jsx            # Interactive AI Chat assistant with subject filter & markdown
            ├── KnowledgeDiscoveryPage.jsx # Unit & topic frequency visual charts and statistics
            ├── ScorePredictorPage.jsx  # Interactive topic checklist and weighted score prediction
            ├── QuizPage.jsx            # Interactive card-based MCQ quiz generator & evaluator
            ├── RevisionNotesPage.jsx   # Interactive revision notes generator with PDF download
            ├── BrowseSubjectsPage.jsx  # Semester-categorized subject catalog
            ├── BrowseDocumentsPage.jsx # Subject document list with preview/download actions
            └── ViewDocumentPage.jsx    # Clean reader view displaying extracted question text
```

---

## 🔍 Detailed File-by-File Explanation

### 1. Project Root Directory

| File / Folder | Type | Role & Implementation Details |
| :--- | :--- | :--- |
| **`manage.py`** | Script | Django's administrative CLI utility. Used to execute database migrations (`migrate`), launch the development server (`runserver`), invoke custom batch commands (`ingest_pyqs`, `tag_units_topics`), and open Django interactive shell. |
| **`requirements.txt`** | Config | Specifies all Python library dependencies: `Django`, `chromadb`, `sentence-transformers`, `google-generativeai`, `matplotlib`, `reportlab`, `pypdf`, `pytesseract`, `pdf2image`, and `python-dotenv`. |
| **`.env`** | Config | Stores local environment secrets, specifically `GEMINI_API_KEY` for Google Generative AI authentication. |
| **`.gitignore`** | Config | Prevents committing temporary or sensitive files: Python virtual environments (`venv/`), Node dependencies (`node_modules/`), build outputs (`frontend/dist/`), generated PDFs (`revision_notes/`), SQLite databases, and local caches. |
| **`run.bat`** | Script | High-convenience Windows launcher. Automatically detects `venv\Scripts\python.exe` (or system Python), opens the default web browser to `http://127.0.0.1:8000/`, and starts the Django server. |
| **`start_server.bat`** | Script | Lightweight one-click shortcut wrapper that delegates directly to `run.bat`. |
| **`db.sqlite3`** | Database | Relational SQLite database tracking subjects, ingested document metadata (exam types, years, file paths), and chat message logs. |
| **`diagnose_subject.py`** | Tool | Diagnostic utility script. Inspects the parsed syllabus JSON cache and lists unclassified PYQ chunks for a given subject to troubleshoot tagging accuracy. |
| **`review_tags.py`** | Tool | Quality audit script. Scans ChromaDB across all subjects and flags those where unclassified/untagged question chunks exceed a threshold (default 15%). |
| **`retag_flagged.py`** | Tool | Batch re-tagging automation script. Iterates through a list of flagged subjects and triggers `tag_units_topics --force` to reclassify chunks. |
| **`chroma_db/`** | Directory | Persistent on-disk vector database directory housing ChromaDB collections (`pyq_chunks`), 384-dimensional dense embeddings, and chunk metadata. |
| **`syllabus_cache/`** | Directory | JSON cache directory containing structured units and topics for each subject (e.g. `physics.json`), preventing redundant Gemini syllabus parsing. |
| **`revision_notes/`** | Directory | Storage directory for compiled revision notes PDF files generated on-demand by ReportLab. |

---

### 2. Django Configuration (`examprep/`)

| File | Type | Role & Implementation Details |
| :--- | :--- | :--- |
| **`examprep/__init__.py`** | Python | Marks the `examprep` folder as an importable Python package. |
| **`examprep/settings.py`** | Config | Main Django configuration file. Registers `chatbot` in `INSTALLED_APPS`, configures template directories pointing to `frontend/dist` and `chatbot/templates`, configures `STATICFILES_DIRS` to serve Vite assets from `frontend/dist/assets`, and sets SQLite database settings. |
| **`examprep/urls.py`** | Routing | Root URL dispatcher that routes `/admin/` to Django Admin and delegates all other application traffic to `chatbot.urls`. |
| **`examprep/wsgi.py`** | Entry Point | WSGI interface configuration for deploying the Django application on traditional WSGI-compliant production servers (e.g., Gunicorn, uWSGI). |
| **`examprep/asgi.py`** | Entry Point | ASGI interface configuration for deploying with asynchronous servers (e.g., Daphne, Uvicorn). |

---

### 3. Core Backend Application (`chatbot/`)

| File | Type | Role & Implementation Details |
| :--- | :--- | :--- |
| **`chatbot/__init__.py`** | Python | Marks `chatbot` as a Python package. |
| **`chatbot/models.py`** | ORM | Defines relational database models: <br>• `Subject`: Stores subject name and semester (unique together). <br>• `Document`: Metadata for PYQs and syllabi (`subject`, `doc_type`, `file_name`, `exam_type`, `year`, `source_path`, `ingested_at`). <br>• `ChatMessage`: Conversation history (`role`, `content`, `subject`, `created_at`). |
| **`chatbot/rag.py`** | Engine | Core RAG retrieval engine: <br>• Initializes `SentenceTransformer('all-MiniLM-L6-v2')` embedder and persistent ChromaDB collection. <br>• `extract_query_filters()`: Parses year, exam type (Midsem/Endsem), and question number (`Q.2(b)`) via regex. <br>• `retrieve_relevant_chunks()`: Performs semantic vector search with filtered fallbacks. <br>• `generate_answer()`: Constructs structured context prompts and queries Gemini models. |
| **`chatbot/gemini_utils.py`** | Utility | Centralized Gemini API client: <br>• Multi-model fallback sequence: `gemini-3.5-flash-lite` → `gemini-3.6-flash` → `gemini-3.5-flash` → `gemini-flash-latest`. <br>• Request throttling (12s spacing) to stay within free-tier limits. <br>• Dynamic 429 quota backoff parsing (`retry in Xs` / `retry_delay`). <br>• `call_gemini_json()`: Extracts and parses JSON responses cleanly. |
| **`chatbot/analytics.py`** | Logic | Computes knowledge statistics and score predictions: <br>• `get_knowledge_stats()`: Aggregates ChromaDB chunks by unit and topic, calculating question distribution maps. <br>• `get_topics_for_subject()`: Returns topic frequency percentages for score prediction checklists. <br>• `predict_score()`: Computes weighted exam score predictions based on student-selected topics. |
| **`chatbot/quiz_engine.py`** | Engine | Quiz generation engine: prompts Gemini with strict JSON formatting to produce multiple-choice questions with 4 options, explanations, and custom question counts based on natural language topic descriptions. Includes strict schema validation (`_validate_quiz`). |
| **`chatbot/notes_engine.py`** | Engine | Revision notes generation engine: <br>• Prompts Gemini for structured topic summaries (sections, bullet points, formulas, diagrams, key terms, exam tips). <br>• Uses Matplotlib to dynamically render LaTeX equations and flow/bar diagrams as high-res images. <br>• Compiles complete printable A4 PDFs with ReportLab flowables, custom styles, and key term tables. |
| **`chatbot/syllabus_parser.py`** | Parser | Extracts raw syllabus text from ChromaDB, prompts Gemini to structure it into standardized units and topics, and caches the result to `syllabus_cache/<subject>.json`. |
| **`chatbot/views.py`** | Views | HTTP controllers and JSON API endpoints: <br>• `react_app`: Serves `frontend/dist/index.html` as the SPA shell. <br>• `api_subjects` & `api_browse_*`: JSON endpoints for catalog, document details, and text previews. <br>• `chat_api`: POST endpoint processing RAG chat queries. <br>• `discovery_data_api`: Returns unit/topic question counts. <br>• `topics_api` & `predict_score_api`: Endpoints powering the Score Predictor. <br>• `quiz_generate_api`: Generates validated MCQ quizzes. <br>• `notes_generate_api`: Generates revision notes & compiles PDF. <br>• `download_notes_pdf`: Streams generated revision notes PDF. <br>• `download_document`: Streams original PYQ PDF files from disk. |
| **`chatbot/urls.py`** | Routing | Maps API endpoints (`/api/subjects/`, `/api/chat/`, `/api/browse/...`, `/api/discover/...`, `/api/predict/...`, `/api/quiz/generate/`, `/api/notes/generate/`, `/notes/download/<filename>/`, `/browse/document/.../download/`) and sets a regex catch-all route to serve the React SPA. |
| **`chatbot/admin.py`** | Admin | Registers `Subject`, `Document`, and `ChatMessage` models for Django's built-in administration panel. |
| **`chatbot/apps.py`** | Config | Defines `ChatbotConfig` application metadata for Django app registry. |
| **`chatbot/tests.py`** | Tests | Unit test test cases and test runner configuration module. |
| **`chatbot/migrations/0001_initial.py`** | Migration | Initial database migration creating database tables for `Subject`, `Document`, and `ChatMessage`. |

---

### 4. Custom Management Commands (`chatbot/management/commands/`)

| File | Type | Role & Implementation Details |
| :--- | :--- | :--- |
| **`ingest_pyqs.py`** | Command | Batch ingestion pipeline: <br>• Traverses the exam PDF directory tree (`<semester>/<subject>/<pdfs>`). <br>• Extracts text using native `pypdf` or `pytesseract` OCR with `pdf2image` + `poppler` for scanned papers. <br>• Splits question papers into sub-question chunks via regex patterns (`1.`, `(a)`, `(b)`). <br>• Embeds chunks with `SentenceTransformer('all-MiniLM-L6-v2')` and stores vectors in ChromaDB while saving metadata to SQLite. |
| **`tag_units_topics.py`** | Command | Batch classification engine: <br>• Loads structured syllabus topics for each subject via `syllabus_parser.py`. <br>• Batches unclassified PYQ chunks (batch size 12) and queries Gemini to assign each chunk to its corresponding syllabus unit and topic. <br>• Updates ChromaDB chunk metadata with unit and topic tags. |

---

### 5. React Frontend Application (`frontend/`)

| File / Folder | Type | Role & Implementation Details |
| :--- | :--- | :--- |
| **`package.json`** | Config | Declares frontend dependencies (`react`, `react-dom`, `react-router-dom`, `d3`, `marked`) and npm scripts (`dev`, `build`, `preview`). |
| **`package-lock.json`** | Config | Locked dependency tree ensuring deterministic npm package installations. |
| **`vite.config.js`** | Config | Vite bundler configuration: sets asset base to `/static/`, outputs production build to `dist/`, and proxies `/api`, `/notes/download`, and `/browse/document` requests to Django on port `8000`. |
| **`index.html`** | HTML | Single Page Application entry point loading Google Fonts (`Space Mono`, `Cormorant Garamond`, `Outfit`) and mounting `src/main.jsx`. |
| **`dist/`** | Directory | Compiled production build directory containing bundled HTML, JS, and CSS static files served by Django. |
| **`src/main.jsx`** | React | Application entry point: initializes React 18 root with `BrowserRouter` and mounts `<App />`. |
| **`src/App.jsx`** | React | Root application component rendering persistent `<CosmicBackground />`, `<TopBar />`, and routing paths for all 8 application pages. |
| **`src/index.css`** | CSS | Complete cosmic design system: dark mode palette, glassmorphism tokens, star glow animations, custom scrollbars, responsive grids, and Markdown typography. |
| **`src/quiz.css`** | CSS | Specialized styling for the Quiz interface: card layouts, option hover/selected states, progress indicators, circular score gauges, and answer explanation cards. |
| **`src/notes.css`** | CSS | Specialized styling for Revision Notes: topic prompt inputs, subject selector, formula preview chips, key-terms table, and PDF download action buttons. |
| **`src/components/CosmicBackground.jsx`** | Component | Animated HTML5 canvas background rendering dynamic stars with twinkling particle physics, depth movement, and responsive resize handling. |
| **`src/components/TopBar.jsx`** | Component | Sticky glassmorphic header navbar providing navigation between Chat, Knowledge Discovery, Score Predictor, Quiz, Notes, and Browse Papers. |
| **`src/pages/ChatPage.jsx`** | Page | Interactive AI assistant interface featuring subject selection dropdown, quick suggestion prompts, markdown-rendered chat bubbles with copy actions, and real-time response generation. |
| **`src/pages/KnowledgeDiscoveryPage.jsx`** | Page | Interactive curriculum intelligence view showing unit breakdowns, topic frequency bar charts, question counts, and syllabus coverage metrics. |
| **`src/pages/ScorePredictorPage.jsx`** | Page | Interactive exam simulator where students select topics they have studied, configure exam total marks, and view predicted scores with detailed topic contribution lists. |
| **`src/pages/QuizPage.jsx`** | Page | Interactive card-based multiple-choice quiz generator with custom question count, instant grading, progress tracker, and per-question answer explanations. |
| **`src/pages/RevisionNotesPage.jsx`** | Page | Interactive revision notes generator allowing students to pick a topic/subject, review structured notes, and download rendered PDFs with formulas and diagrams. |
| **`src/pages/BrowseSubjectsPage.jsx`** | Page | Semester-categorized subject catalog displaying PYQ counts, year spans, and exam type badges. |
| **`src/pages/BrowseDocumentsPage.jsx`** | Page | Subject-specific document view listing all midsem, endsem, and supplementary papers with quick preview and download buttons. |
| **`src/pages/ViewDocumentPage.jsx`** | Page | Full-screen reader view displaying extracted question paper contents with direct PDF download option. |

---

## 🌐 API Reference

| Endpoint | Method | Payload / Query | Description |
| :--- | :--- | :--- | :--- |
| **`/api/subjects/`** | `GET` | — | Returns all subjects grouped by semester. |
| **`/api/chat/`** | `POST` | `{"message": "...", "subject": "..."}` | Submits a query to the RAG pipeline and returns the AI response with citations. |
| **`/api/browse/`** | `GET` | `?sem=3rd%20Semester` | Returns subject cards with paper counts, year ranges, and exam types. |
| **`/api/browse/subject/<id>/`** | `GET` | — | Returns list of all PYQs and syllabus document for a specific subject. |
| **`/api/browse/document/<id>/`** | `GET` | — | Returns extracted plain-text preview of a document. |
| **`/browse/document/<id>/download/`** | `GET` | — | Streams the raw PDF file from disk for download. |
| **`/api/discover/<subject_id>/`** | `GET` | — | Returns question count breakdowns grouped by unit and topic. |
| **`/api/predict/topics/<subject_id>/`** | `GET` | — | Returns all syllabus topics with historical frequency percentages. |
| **`/api/predict/score/`** | `POST` | `{"subject_id": 1, "studied_topics": [...], "total_marks": 50}` | Computes weighted score prediction based on studied topics. |
| **`/api/quiz/generate/`** | `POST` | `{"topic_description": "...", "num_questions": 10}` | Generates a validated multiple-choice quiz with answers & explanations. |
| **`/api/notes/generate/`** | `POST` | `{"topic": "...", "subject_id": 1}` | Generates revision notes JSON and builds a downloadable PDF. |
| **`/notes/download/<filename>/`** | `GET` | — | Streams a generated revision notes PDF file for download. |

---

## 🚀 Setup & Installation

### 1. Prerequisites
- **Python**: Version 3.10+ installed
- **Node.js**: Version 18+ installed (for building the React frontend)
- **Tesseract OCR** *(Optional, for OCR on scanned PDFs)*: Installed at `C:\Program Files\Tesseract-OCR\tesseract.exe`
- **Poppler** *(Optional, for converting PDFs to images for OCR)*

### 2. Python Environment Setup
```bash
# Clone or open the repository
cd pyq-chatbot

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Frontend Setup & Build
```bash
# Navigate to the frontend directory
cd frontend

# Install Node dependencies
npm install

# Build production bundle (outputs to frontend/dist)
npm run build

# Return to root directory
cd ..
```

### 4. Environment Variables
Create a `.env` file in the project root:
```env
GEMINI_API_KEY=your_google_gemini_api_key_here
```

### 5. Database Setup & Ingestion
```bash
# Apply database migrations
python manage.py migrate

# Ingest PYQ PDFs and syllabus files into ChromaDB & SQLite
python manage.py ingest_pyqs

# Classify and tag PYQ chunks with syllabus units & topics
python manage.py tag_units_topics
```

---

## 🏃 Running the Application

### Option A: One-Click Windows Launcher (Recommended)
Simply double-click or execute:
```bash
run.bat
```
This automatically detects your virtual environment, launches the server, and opens `http://127.0.0.1:8000/` in your default browser.

### Option B: Manual Django CLI
```bash
python manage.py runserver 127.0.0.1:8000
```

### Option C: Concurrent Frontend Development (Vite Dev Server)
For live frontend hot-reloading:
```bash
# Terminal 1: Django Backend
python manage.py runserver 127.0.0.1:8000

# Terminal 2: Vite Dev Server
cd frontend
npm run dev
```
Visit Vite at `http://localhost:5173/` (all `/api` and `/notes/download` requests are proxied to Django).

---

## 🔧 Maintenance & Diagnostic Tools

| Task | Command | Description |
| :--- | :--- | :--- |
| **Audit Tag Quality** | `python review_tags.py` | Scans ChromaDB across all subjects and flags those with >15% unclassified chunks. |
| **Diagnose Specific Subject** | `python diagnose_subject.py` | Prints parsed syllabus structure and all unclassified questions for a subject. |
| **Batch Re-tag Flagged Subjects** | `python retag_flagged.py` | Automatically runs `tag_units_topics --force` on flagged subjects. |
| **Re-tag a Single Subject** | `python manage.py tag_units_topics --subject "physics" --force` | Re-classifies all question chunks for a single subject. |

---

## 🛠️ Technology Stack

- **Backend**: Python 3, Django 5.x
- **Frontend**: React 18, Vite, React Router 6, D3.js, Marked.js, Vanilla CSS
- **Vector Database**: ChromaDB (Persistent Storage)
- **Embeddings**: `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions)
- **Generative AI**: Google Gemini API (`gemini-3.5-flash-lite`, `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-flash-latest`)
- **Document & PDF Generation**: ReportLab, Matplotlib (LaTeX formula rendering & diagram plotting)
- **PDF & OCR Processing**: PyPDF, Tesseract-OCR, PDF2Image, Poppler
- **Relational Database**: SQLite3
