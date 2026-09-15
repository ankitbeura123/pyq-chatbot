# 🌌 Observatory — KIIT PYQ AI Assistant

**Observatory** is an intelligent, AI-powered Exam Preparation Assistant tailored for KIIT students. It indexes Previous Year Question (PYQ) papers and course syllabi into a vector database, enabling students to interactively chat with an AI grounded in past exam questions, identify repeating patterns, search specific question solutions, and browse/download past papers organized by semester and subject.

---

## 🌟 Key Features

- 💬 **Grounded AI Chatbot**: Powered by Google Gemini (`gemini-flash` models) and ChromaDB vector search. The assistant answers questions, solves complex problems step-by-step, explains repeating patterns, and suggests high-yield exam topics.
- 🎯 **Intelligent Query Filter Extraction**: Automatically detects mentions of specific years (e.g., `2018`, `2022`), exam sessions (`Midsem`, `Endsem`, `Supplementary`), and subquestions (e.g., `Q.3(b)`) directly from natural language prompts to perform exact metadata-filtered retrieval.
- 📚 **Semester & Subject PYQ Browser**: Explore past papers categorized by semester with metadata tags (paper count, year span, and exam type indicators).
- 📄 **In-Browser Document Preview & Download**: Preview extracted question paper text directly in the browser or download the original exam PDF files with a single click.
- 🎨 **Cosmic Glassmorphic UI**: Minimalist, responsive dark-mode interface featuring animated starfield canvas, celestial glow aesthetics, typography, and Markdown rendering.

---

## 🏗️ Architecture & Data Flow

```
+-------------------------------------------------------------------------+
|                          1. INGESTION PIPELINE                          |
|                                                                         |
|  [ Exam PDFs & Syllabus ]                                               |
|           │                                                             |
|           ├──> PyPDF / OCR (Tesseract + Poppler)                        |
|           ├──> Sub-question & Header Chunking Regex                     |
|           ├──> SentenceTransformer ('all-MiniLM-L6-v2') Embeddings      |
|           └──> Storage: SQLite (Metadata) + ChromaDB (Vector Embeddings)|
+-------------------------------------------------------------------------+

+-------------------------------------------------------------------------+
|                            2. RAG CHAT FLOW                             |
|                                                                         |
|  [ Student Query ]                                                      |
|           │                                                             |
|           ├──> Filter Extraction (Subject, Year, Exam Type, Question #) |
|           ├──> Query Vector Embedding                                   |
|           ├──> ChromaDB Vector Similarity Search (+ Filtered Fallbacks) |
|           ├──> Context Construction & System Prompt Engineering         |
|           └──> Google Gemini Generative AI Model                        |
|           │                                                             |
|           └──> Formatted Markdown Response Rendered in UI               |
+-------------------------------------------------------------------------+
```

---

## 📁 Project Directory Structure

```
pyq-chatbot/
│
├── .env                                # Environment variables (Gemini API key)
├── .gitignore                          # Ignored files (venv, chroma_db, db.sqlite3, etc.)
├── manage.py                           # Django command-line administrative utility
├── requirements.txt                    # Project Python dependencies
├── run.bat                             # One-click Windows fast launcher script
├── start_server.bat                    # Server start shortcut script
├── db.sqlite3                          # SQLite database (Subjects, Documents, Messages)
├── README.md                           # Project documentation
│
├── chroma_db/                          # Persistent ChromaDB vector database files
│   ├── chroma.sqlite3                  # ChromaDB internal index metadata
│   └── ...                             # Vector indexes and chunk storage
│
├── examprep/                           # Django Project Configuration Package
│   ├── __init__.py                     # Package indicator
│   ├── asgi.py                         # ASGI entry point for async deployment
│   ├── settings.py                     # Main project configuration & installed apps
│   ├── urls.py                         # Root URL routing (delegates to chatbot.urls)
│   └── wsgi.py                         # WSGI entry point for web servers
│
└── chatbot/                            # Core Application Package
    ├── __init__.py                     # App package indicator
    ├── admin.py                        # Django Admin site model registrations
    ├── apps.py                         # Application configuration (ChatbotConfig)
    ├── models.py                       # Data models (Subject, Document, ChatMessage)
    ├── rag.py                          # RAG pipeline, ChromaDB retrieval, Gemini LLM
    ├── urls.py                         # Application-level URL routes (Chat & Browse)
    ├── views.py                        # View controllers for Chat, Browse & Preview
    ├── tests.py                        # Unit testing module
    │
    ├── management/                     # Custom Django management commands
    │   ├── __init__.py
    │   └── commands/
    │       ├── __init__.py
    │       └── ingest_pyqs.py          # Command to parse, OCR, chunk & ingest PYQs
    │
    ├── migrations/                     # Database migrations
    │   ├── __init__.py
    │   └── 0001_initial.py             # Initial schema for Subject, Document, ChatMessage
    │
    └── templates/chatbot/              # HTML Templates
        ├── base.html                   # Base layout with navbar, stars canvas, & styling
        ├── chat.html                   # Chat interface with subject filter & markdown
        ├── browse_subjects.html        # Semester-grouped subject catalog
        ├── browse_documents.html       # Document list for a selected subject
        └── view_document.html          # Plaintext preview page for question papers
```

---

## 🔍 Detailed File-by-File Breakdown

### Root Directory

| File | Description |
| :--- | :--- |
| **`manage.py`** | Standard Django CLI tool used to execute migrations, launch the development server, and run custom management commands like `ingest_pyqs`. |
| **`requirements.txt`** | Lists all Python dependencies, including Django, ChromaDB, Sentence-Transformers, Google Generative AI SDK, PyPDF, PyTesseract, and PDF2Image. |
| **`.env`** | Configuration file storing sensitive credentials, specifically `GEMINI_API_KEY`. |
| **`.gitignore`** | Excludes virtual environments, vector databases, caches, and local configuration files from version control. |
| **`run.bat`** | Windows batch script that automatically detects the Python virtual environment (`venv`) and launches the development server on `http://127.0.0.1:8000/`. |
| **`start_server.bat`** | Simple wrapper shortcut that delegates execution to `run.bat`. |
| **`db.sqlite3`** | Relational SQLite database tracking metadata for subjects, ingested documents, file paths, and chat history. |
| **`chroma_db/`** | Persistent vector database directory where question paper text chunks, syllabus sections, and their 384-dimensional embeddings are indexed. |

---

### Django Project Configuration (`examprep/`)

| File | Description |
| :--- | :--- |
| **`examprep/settings.py`** | Main configuration file defining installed applications (`chatbot`), template directories, middleware, database connections, and localization settings. |
| **`examprep/urls.py`** | Root URL dispatcher that routes administrative requests to `admin/` and forwards all main traffic to `chatbot.urls`. |
| **`examprep/wsgi.py`** | WSGI interface configuration for deploying the Django application on traditional web servers. |
| **`examprep/asgi.py`** | ASGI interface configuration for asynchronous web server deployments. |

---

### Core Application (`chatbot/`)

| File | Description |
| :--- | :--- |
| **`chatbot/models.py`** | Defines database tables: <br>• `Subject`: Stores subject names and semester levels. <br>• `Document`: Stores metadata (year, exam type, doc type, source file path) for PYQs and syllabi. <br>• `ChatMessage`: Records chat interaction logs. |
| **`chatbot/rag.py`** | Core Retrieval-Augmented Generation module: <br>• Embeds user queries using `SentenceTransformer('all-MiniLM-L6-v2')`. <br>• Extracts query intent (year, exam type, question number). <br>• Queries ChromaDB with strict filtering and multi-level fallbacks. <br>• Formats contextual prompts and interfaces with Google Gemini Generative AI (`gemini-flash` models). |
| **`chatbot/views.py`** | HTTP request handlers: <br>• `chat_page`: Renders the chat UI with subject choices. <br>• `chat_api`: POST endpoint processing chat inputs, storing history, and returning RAG responses. <br>• `browse_subjects`: Renders subjects organized by semester. <br>• `browse_documents`: Renders all question papers and syllabus status for a subject. <br>• `download_document`: Streams the raw PDF file for downloading. <br>• `view_document`: Extracts text on the fly using PyPDF for an in-browser preview. |
| **`chatbot/urls.py`** | Defines clean route mappings for all user-facing views: `/`, `/api/chat/`, `/browse/`, `/browse/subject/<id>/`, `/browse/document/<id>/`, and `/browse/document/<id>/download/`. |
| **`chatbot/admin.py`** | Django administration panel configuration. |
| **`chatbot/apps.py`** | Django application configuration metadata. |
| **`chatbot/tests.py`** | Unit test configuration module. |
| **`chatbot/management/commands/ingest_pyqs.py`** | Offline batch ingestion script: <br>• Traverses the exam folder structure (`<semester>/<subject>/<pdfs>`). <br>• Extracts text via native PyPDF or OCR (Tesseract + Poppler for scanned papers). <br>• Splits questions into sub-question chunks via regex. <br>• Indexes embeddings and metadata into ChromaDB and Django SQLite. |
| **`chatbot/migrations/0001_initial.py`** | Database schema migration creating initial tables for `Subject`, `Document`, and `ChatMessage`. |

---

### HTML Templates (`chatbot/templates/chatbot/`)

| File | Description |
| :--- | :--- |
| **`base.html`** | Root base layout featuring navigation (Chat, Browse), animated HTML5 canvas starfield background, planetary gradients, Google Fonts (`Space Mono`, `Cormorant Garamond`), and global CSS design tokens. |
| **`chat.html`** | Interactive AI Chat page featuring subject selection dropdown, auto-expanding prompt composer, Markdown response rendering with Marked.js, and loading pulse states. |
| **`browse_subjects.html`** | Subject explorer organized with semester filter tabs, showing question counts, available year spans, and exam type badges. |
| **`browse_documents.html`** | Document browser for an individual subject, listing all midsem, endsem, and supplementary papers with quick preview and download actions. |
| **`view_document.html`** | Clean reader preview showing the extracted text of any past question paper with a direct download link. |

---

## 🚀 Setup & Installation

### 1. Prerequisites
- **Python**: Version 3.10+ installed
- **Tesseract OCR** *(Optional, for scanned PDFs)*: Installed at `C:\Program Files\Tesseract-OCR\tesseract.exe`
- **Poppler** *(Optional, for PDF rendering to OCR images)*

### 2. Environment Setup
Clone the repository and set up a virtual environment:
```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### 3. API Key Configuration
Create a `.env` file in the root directory:
```env
GEMINI_API_KEY=your_google_gemini_api_key_here
```

### 4. Database Setup & Ingestion
Apply database migrations:
```bash
python manage.py migrate
```

If ingesting new question papers from a directory:
```bash
python manage.py ingest_pyqs
```

### 5. Running the Application
Launch the server via the batch script:
```bash
run.bat
```
Or directly using the Django CLI:
```bash
python manage.py runserver 127.0.0.1:8000
```
Visit **`http://127.0.0.1:8000/`** in your browser.

---

## 🌐 Application URL Routes

| Endpoint | Method | View Function | Description |
| :--- | :--- | :--- | :--- |
| `/` | `GET` | `chat_page` | Main AI exam chat assistant interface |
| `/api/chat/` | `POST` | `chat_api` | JSON API for RAG chat responses |
| `/browse/` | `GET` | `browse_subjects` | Browse subjects by semester |
| `/browse/subject/<id>/` | `GET` | `browse_documents` | List question papers for a subject |
| `/browse/document/<id>/` | `GET` | `view_document` | In-browser question paper text preview |
| `/browse/document/<id>/download/` | `GET` | `download_document` | Download original question paper PDF |

---

## 🛠️ Technology Stack

- **Framework**: Django 5.x
- **Vector Search**: ChromaDB
- **Embedding Model**: `sentence-transformers/all-MiniLM-L6-v2`
- **LLM Engine**: Google Gemini API
- **Document Processing**: PyPDF, Tesseract-OCR, PDF2Image, Poppler
- **Frontend**: Django Templates, Vanilla CSS, Marked.js
