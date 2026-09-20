import React from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare,
  TrendingUp,
  Target,
  HelpCircle,
  FileText,
  FolderOpen,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { OrchidLogo } from '../components/TopBar';

export default function HomePage() {
  return (
    <div className="wrap" id="top">
      {/* HERO */}
      <div className="hero">
        <div>
          <h1>Every KIIT past paper, searchable and explained.</h1>
          <p className="sub">
            Orchids reads your previous year question papers and course syllabi,
            then answers questions from them with sources you can check. It also
            predicts your score, quizzes you, and writes revision notes.
          </p>
          <div className="cta-row">
            <Link className="pill-dark btn-hero" to="/chat">
              <MessageSquare size={16} />
              Start chatting
            </Link>
            <Link className="btn-link" to="/browse">
              Browse past papers →
            </Link>
            <Link className="btn-link" to="/quiz">
              Take an AI quiz →
            </Link>
          </div>
          <p className="note">
            Built for KIIT students. Answers cite the exact paper, year and
            question number.
          </p>
        </div>

        <div
          className="preview"
          role="img"
          aria-label="Preview of the Orchids chat answering a question about a past paper"
        >
          <div className="pv-head">
            <span className="model-badge">
              <i></i>Gemini · grounded in PYQs
            </span>
            <span className="pv-filter">All subjects</span>
          </div>
          <div className="pv-body">
            <div className="row user">
              <div className="bubble">
                Solve Q.2(b) from the 2023 endsem and tell me if it repeats.
              </div>
            </div>
            <div className="row ai">
              <div className="avatar" title="Orchids AI">
                <OrchidLogo size={16} />
              </div>
              <div className="bubble">
                Found it. The question asks for the <b>steady-state solution</b> of
                the given system:
                <ol>
                  <li>Write the governing equation with the given boundary values.</li>
                  <li>
                    Apply <code>dT/dt = 0</code> and integrate twice.
                  </li>
                  <li>
                    Substitute the boundary conditions to fix both constants.
                  </li>
                </ol>
                This topic appeared in <b>4 of the last 6</b> papers.
                <div className="cites">
                  <span className="chip">Endsem 2023 · Q.2(b)</span>
                  <span className="chip">Midsem 2021 · Q.3</span>
                  <span className="chip">Endsem 2019 · Q.2(a)</span>
                </div>
              </div>
            </div>
          </div>
          <Link to="/chat" className="pv-input" style={{ textDecoration: 'none' }}>
            <span>
              Ask about any paper or topic<span className="caret"></span>
            </span>
            <span className="send">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </span>
          </Link>
        </div>
      </div>

      {/* FEATURES */}
      <section id="features" className="home-section">
        <div className="showcase">
          <div className="tag-label">What you can do</div>
          <div className="grid3">
            <Link className="card feature-card" to="/chat">
              <div className="ic">
                <MessageSquare size={20} strokeWidth={1.75} />
              </div>
              <h3>Ask the assistant</h3>
              <p>
                Get step-by-step solutions and exam trends. Mention a year,
                session or question number and it searches exactly there first.
              </p>
              <div className="go">Try Chat →</div>
            </Link>

            <Link className="card feature-card" to="/discover">
              <div className="ic">
                <TrendingUp size={20} strokeWidth={1.75} />
              </div>
              <h3>Discover what matters</h3>
              <p>
                See how questions spread across units and syllabus topics, ranked
                by how often each one is asked.
              </p>
              <div className="go">Explore topics →</div>
            </Link>

            <Link className="card feature-card" to="/predict">
              <div className="ic">
                <Target size={20} strokeWidth={1.75} />
              </div>
              <h3>Predict your score</h3>
              <p>
                Tick the topics you have studied. Orchids weighs them by past
                frequency and shows the marks each one contributes.
              </p>
              <div className="go">Calculate score →</div>
            </Link>

            <Link className="card feature-card" to="/quiz">
              <div className="ic">
                <HelpCircle size={20} strokeWidth={1.75} />
              </div>
              <h3>Take a quiz</h3>
              <p>
                Describe a topic and get multiple-choice questions with instant
                marking and an explanation for every answer.
              </p>
              <div className="go">Start quiz →</div>
            </Link>

            <Link className="card feature-card" to="/notes">
              <div className="ic">
                <FileText size={20} strokeWidth={1.75} />
              </div>
              <h3>Make revision notes</h3>
              <p>
                Get structured notes with formulas, diagrams, key terms and exam
                tips, and download them as a printable PDF.
              </p>
              <div className="go">Generate notes →</div>
            </Link>

            <Link className="card feature-card" to="/browse">
              <div className="ic">
                <FolderOpen size={20} strokeWidth={1.75} />
              </div>
              <h3>Browse papers</h3>
              <p>
                Access any midsem, endsem or supplementary paper by semester and
                subject, and download the PDF directly.
              </p>
              <div className="go">Browse archives →</div>
            </Link>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="home-section">
        <div className="sec-head">
          <h2>From scanned PDF to a cited answer</h2>
          <p>
            Papers are indexed once. After that, every feature reads from the
            same indexed copy of your papers and syllabus.
          </p>
        </div>
        <div className="steps">
          <div className="card step">
            <h3>Read the papers</h3>
            <p>
              PDFs are read directly, and scanned ones are run through OCR. Each
              paper is split into individual sub-questions.
            </p>
            <div className="tech">PyPDF · Tesseract · Poppler</div>
          </div>
          <div className="card step">
            <h3>Embed and store</h3>
            <p>
              Every sub-question becomes a searchable vector. Subjects and
              paper details are kept in a relational store.
            </p>
            <div className="tech">MiniLM-L6-v2 · ChromaDB · SQLite</div>
          </div>
          <div className="card step">
            <h3>Map to the syllabus</h3>
            <p>
              Gemini structures each syllabus into units and topics, then tags
              every question with the topic it belongs to.
            </p>
            <div className="tech">Gemini JSON · syllabus cache</div>
          </div>
          <div className="card step">
            <h3>Answer with sources</h3>
            <p>
              Filters like year and session run first, then semantic search. The
              answer cites the papers it came from.
            </p>
            <div className="tech">RAG · multi-model fallback</div>
          </div>
        </div>
      </section>

      {/* INSIDE */}
      <section id="inside" className="home-section">
        <div className="sec-head">
          <h2>Ask the way you would ask a senior</h2>
          <p>
            No filters to set up. Write naturally and Orchids picks out the year,
            session and question number for you.
          </p>
        </div>
        <div className="two">
          <div className="panel">
            <h3>Questions that work</h3>
            <p>
              Each of these is turned into a precise search before falling back
              to meaning-based matching.
            </p>
            <div className="qs">
              <Link
                to="/chat?prompt=Show%20the%202019%20endsem%20questions%20on%20eigenvalues"
                className="q"
              >
                Show the 2019 endsem questions on eigenvalues
              </Link>
              <Link
                to="/chat?prompt=Explain%20Q.2(b)%20from%20the%202023%20midsem%20step%20by%20step"
                className="q"
              >
                Explain Q.2(b) from the 2023 midsem step by step
              </Link>
              <Link
                to="/chat?prompt=Which%20topics%20repeat%20the%20most%20in%20supplementary%20papers%3F"
                className="q"
              >
                Which topics repeat the most in supplementary papers?
              </Link>
              <Link
                to="/chat?prompt=Predict%20what%20could%20come%20in%20this%20semester%27s%20endsem"
                className="q"
              >
                Predict what could come in this semester's endsem
              </Link>
            </div>
          </div>
          <div className="panel">
            <h3>See where marks come from</h3>
            <p>
              Topic weight is how often a topic has appeared. Your predicted
              score follows what you have covered.
            </p>
            <div className="bars" aria-label="Sample topic frequency chart">
              <div className="bar-row">
                <span>Unit 2 · Differential equations</span>
                <span>32%</span>
                <div className="track">
                  <div className="fill" style={{ width: '32%' }}></div>
                </div>
              </div>
              <div className="bar-row">
                <span>Unit 4 · Vector calculus</span>
                <span>26%</span>
                <div className="track">
                  <div className="fill" style={{ width: '26%' }}></div>
                </div>
              </div>
              <div className="bar-row">
                <span>Unit 1 · Matrices</span>
                <span>21%</span>
                <div className="track">
                  <div className="fill amber" style={{ width: '21%' }}></div>
                </div>
              </div>
              <div className="bar-row">
                <span>Unit 3 · Series</span>
                <span>13%</span>
                <div className="track">
                  <div className="fill amber" style={{ width: '13%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="panel" style={{ marginTop: '16px' }}>
          <h3>Built with</h3>
          <p>
            A Django backend, a React single-page interface, and Google Gemini
            for reasoning.
          </p>
          <div className="stack">
            <span className="s">
              React 18<small>Vite</small>
            </span>
            <span className="s">Django 5</span>
            <span className="s">
              ChromaDB<small>384-dim vectors</small>
            </span>
            <span className="s">Sentence Transformers</span>
            <span className="s">
              Google Gemini<small>4-model fallback</small>
            </span>
            <span className="s">
              ReportLab<small>PDF notes</small>
            </span>
            <span className="s">
              Matplotlib<small>LaTeX formulas</small>
            </span>
            <span className="s">SQLite</span>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="home-section">
        <div className="final">
          <div>
            <h2>Start with the paper you dread most.</h2>
            <p>
              Pick a subject, ask about last year's hardest question, and see what
              it answers.
            </p>
          </div>
          <div className="cta-row">
            <Link className="pill-dark btn-hero" to="/chat">
              Start chatting
            </Link>
            <Link className="btn-link" to="/browse">
              Browse papers →
            </Link>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <span>Orchids · KIIT PYQ AI Assistant</span>
        <span>
          Answers are grounded in indexed papers. Always verify against your
          official syllabus.
        </span>
      </footer>
    </div>
  );
}
