import React, { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  Download,
  RotateCcw,
  Sparkles,
  Clock,
  Award,
  BookOpen,
  CheckCircle2,
  FileText,
  HelpCircle,
  Eye,
  Check
} from "lucide-react";
import CustomSelect from "../components/CustomSelect";
import MathRenderer from "../components/MathRenderer";
import "../mock.css";

const GENERATE_ENDPOINT = "/api/mock/generate/";
const SYLLABUS_PREVIEW_ENDPOINT = "/api/mock/syllabus-preview/";

export default function MockExamPage() {
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [examType, setExamType] = useState("midsem");
  const [syllabusScope, setSyllabusScope] = useState(null);

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState(null);

  const [paperData, setPaperData] = useState(null);
  const [qpFilename, setQpFilename] = useState(null);
  const [ansFilename, setAnsFilename] = useState(null);
  const [activeTab, setActiveTab] = useState("qp"); // "qp" or "ans"

  // Fetch subjects list on mount
  useEffect(() => {
    fetch("/api/subjects/")
      .then((res) => res.json())
      .then((data) => {
        const all = data.all_subjects || [];
        setSubjects(all);
        if (all.length > 0 && !subjectId) {
          setSubjectId(String(all[0].id));
        }
      })
      .catch(() => {});
  }, []);

  // Update syllabus preview whenever subjectId or examType changes
  useEffect(() => {
    if (!subjectId) {
      setSyllabusScope(null);
      return;
    }
    fetch(`${SYLLABUS_PREVIEW_ENDPOINT}?subject_id=${subjectId}&exam_type=${examType}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.scope) {
          setSyllabusScope(data.scope);
        }
      })
      .catch(() => {});
  }, [subjectId, examType]);

  // Loading animation simulation steps
  useEffect(() => {
    let timer;
    if (loading) {
      setLoadingStep(1);
      timer = setInterval(() => {
        setLoadingStep((prev) => (prev < 4 ? prev + 1 : prev));
      }, 3500);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(timer);
  }, [loading]);

  async function handleGenerate(e) {
    if (e) e.preventDefault();
    if (!subjectId) {
      setError("Please select a subject.");
      return;
    }

    setError(null);
    setLoading(true);
    setPaperData(null);
    setQpFilename(null);
    setAnsFilename(null);

    try {
      const res = await fetch(GENERATE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_id: parseInt(subjectId, 10),
          exam_type: examType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate mock paper.");
      }
      setPaperData(data.paper);
      setQpFilename(data.qp_filename);
      setAnsFilename(data.ans_filename);
      setActiveTab("qp");
    } catch (err) {
      setError(err.message || "An error occurred while generating the mock paper.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setPaperData(null);
    setQpFilename(null);
    setAnsFilename(null);
    setError(null);
  }

  const selectedSubjectObj = subjects.find((s) => String(s.id) === String(subjectId));

  return (
    <div className="mock-page">
      {/* 1. SETUP CARD (When no paper is generated yet) */}
      {!paperData && (
        <div className="mock-setup-card card">
          <h1 className="mock-title">
            <FileSpreadsheet size={26} color="#2563eb" />
            Generate Mock Examination Paper
          </h1>
          <p className="mock-subtitle">
            Generate authentic KIIT university-standard examination question papers
            grounded in past paper patterns and syllabus limits, complete with downloadable
            LaTeX-styled Question Paper and Step-by-Step Answer Key PDFs.
          </p>

          <form onSubmit={handleGenerate} className="mock-form">
            {/* Subject Selector */}
            <div>
              <label className="mock-label" htmlFor="mock-subject-select">
                Select Subject
                {selectedSubjectObj && (
                  <span style={{ color: "#2563eb", textTransform: "none", fontWeight: 600 }}>
                    Semester: {selectedSubjectObj.semester}
                  </span>
                )}
              </label>
              <CustomSelect
                id="mock-subject-select"
                value={subjectId}
                onChange={(val) => setSubjectId(val)}
                placeholder="— Choose Course / Subject —"
                options={subjects.map((s) => ({
                  value: String(s.id),
                  label: `${s.name} (${s.semester})`,
                }))}
              />
            </div>

            {/* Exam Type Selector */}
            <div>
              <label className="mock-label">Select Examination Type</label>
              <div className="exam-type-grid">
                {/* Midsem Option */}
                <div
                  className={`exam-type-card ${examType === "midsem" ? "selected" : ""}`}
                  onClick={() => setExamType("midsem")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="exam-type-header">
                    <span className="exam-type-name">Mid-Semester Exam</span>
                    <span className="exam-badge">20 Marks</span>
                  </div>
                  <div className="exam-type-meta">
                    <span>
                      <Clock size={12} style={{ display: "inline", marginRight: 4 }} />
                      1.5 Hours
                    </span>
                    <span>
                      <Award size={12} style={{ display: "inline", marginRight: 4 }} />
                      Q.1 (5m) + Any 3 from Q.2-Q.5 (15m)
                    </span>
                  </div>
                  <p className="exam-type-desc">
                    Covers <b>first half of course syllabus</b> (e.g. 3 of 6 units, or 2.5 of 5 units).
                  </p>
                </div>

                {/* Endsem Option */}
                <div
                  className={`exam-type-card ${examType === "endsem" ? "selected" : ""}`}
                  onClick={() => setExamType("endsem")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="exam-type-header">
                    <span className="exam-type-name">End-Semester Exam</span>
                    <span className="exam-badge">50 Marks</span>
                  </div>
                  <div className="exam-type-meta">
                    <span>
                      <Clock size={12} style={{ display: "inline", marginRight: 4 }} />
                      3.0 Hours
                    </span>
                    <span>
                      <Award size={12} style={{ display: "inline", marginRight: 4 }} />
                      Q.1 (10m) + Any 4 from Q.2-Q.7 (40m)
                    </span>
                  </div>
                  <p className="exam-type-desc">
                    Covers <b>entire course syllabus</b> across all modules and units.
                  </p>
                </div>
              </div>
            </div>

            {/* Syllabus Coverage & PYQ Grounding Live Preview */}
            {syllabusScope && (
              <div className="syllabus-scope-card">
                <div className="syllabus-scope-head">
                  <span>
                    <BookOpen size={13} style={{ display: "inline", marginRight: 5 }} />
                    {syllabusScope.scope_label}
                  </span>
                  <span>
                    {syllabusScope.units?.length || 0} Units • {syllabusScope.pyq_doc_count ? `${syllabusScope.pyq_doc_count} PYQ Papers Grounded` : 'PYQs Grounded'}
                  </span>
                </div>
                <div className="syllabus-unit-tags">
                  {(syllabusScope.units || []).map((u, i) => (
                    <span key={i} className="unit-tag">
                      <b>{u.unit}:</b> {u.title}
                    </span>
                  ))}
                </div>
                <div style={{ marginTop: 8, fontSize: "0.82rem", color: "#1e40af", display: "flex", alignItems: "center", gap: 6, background: "rgba(37,99,235,0.06)", padding: "4px 8px", borderRadius: 4 }}>
                  <CheckCircle2 size={13} color="#2563eb" />
                  <span>Dual Grounding Active: Synthesizes real KIIT PYQ question archetypes & formula derivations with official syllabus scope.</span>
                </div>
              </div>
            )}

            {error && <div className="notes-error">{error}</div>}

            {/* Generate Button */}
            <button
              type="submit"
              className="hero-btn-dark"
              style={{ marginTop: 10, alignSelf: "flex-start" }}
              disabled={loading}
            >
              <Sparkles size={16} />
              {loading ? "Synthesizing Mock Paper…" : "Generate Mock Paper & Solutions"}
            </button>
          </form>
        </div>
      )}

      {/* 2. ANIMATED LOADING PROGRESS */}
      {loading && (
        <div className="mock-loading-card card">
          <div className="loading-spinner-ring"></div>
          <div>
            <h2 style={{ margin: "0 0 6px", fontSize: "1.25rem", color: "#0f172a" }}>
              Creating Official Mock Examination Paper
            </h2>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.95rem" }}>
              Grounding questions in syllabus units and past examination standards…
            </p>
          </div>

          <div className="loading-step-list">
            <div className={`loading-step-item ${loadingStep >= 1 ? (loadingStep > 1 ? "done" : "active") : ""}`}>
              {loadingStep > 1 ? <CheckCircle2 size={16} color="#059669" /> : <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid currentColor" }} />}
              <span>1. Extracting syllabus boundaries for {examType.toUpperCase()}…</span>
            </div>
            <div className={`loading-step-item ${loadingStep >= 2 ? (loadingStep > 2 ? "done" : "active") : ""}`}>
              {loadingStep > 2 ? <CheckCircle2 size={16} color="#059669" /> : <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid currentColor" }} />}
              <span>2. Analyzing KIIT previous year questions & marks distribution…</span>
            </div>
            <div className={`loading-step-item ${loadingStep >= 3 ? (loadingStep > 3 ? "done" : "active") : ""}`}>
              {loadingStep > 3 ? <CheckCircle2 size={16} color="#059669" /> : <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid currentColor" }} />}
              <span>3. Formulating authentic exam questions & LaTeX expressions…</span>
            </div>
            <div className={`loading-step-item ${loadingStep >= 4 ? "active" : ""}`}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid currentColor" }} />
              <span>4. Compiling Question Paper & Answer Key PDFs…</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. GENERATED RESULT & EXAM PAPER VIEW */}
      {paperData && (
        <div className="mock-result">
          {/* Header Action Bar */}
          <div className="mock-result-header">
            <div className="mock-header-info">
              <h1>{paperData.subject_name}</h1>
              <div className="mock-header-sub">
                <span><b>Exam:</b> {paperData.exam_title}</span>
                <span><b>Time:</b> {paperData.time_allowed}</span>
                <span><b>Full Marks:</b> {paperData.full_marks}</span>
              </div>
            </div>

            <div className="mock-action-group">
              {qpFilename && (
                <a
                  className="btn-download-qp"
                  href={`/mock/download/${qpFilename}/`}
                  download
                  title="Download Question Paper PDF"
                >
                  <Download size={15} />
                  Question Paper (PDF)
                </a>
              )}
              {ansFilename && (
                <a
                  className="btn-download-ans"
                  href={`/mock/download/${ansFilename}/`}
                  download
                  title="Download Step-by-Step Solutions PDF"
                >
                  <Download size={15} />
                  Answer Key (PDF)
                </a>
              )}
              <button type="button" className="btn" onClick={handleReset} title="Create another mock test">
                <RotateCcw size={14} />
                New Exam
              </button>
            </div>
          </div>

          {/* View Switcher Tabs */}
          <div className="view-tabs-bar">
            <button
              className={`tab-btn ${activeTab === "qp" ? "active" : ""}`}
              onClick={() => setActiveTab("qp")}
            >
              <FileText size={15} />
              Question Paper
            </button>
            <button
              className={`tab-btn ${activeTab === "ans" ? "active" : ""}`}
              onClick={() => setActiveTab("ans")}
            >
              <Check size={15} color="#059669" />
              Solutions & Marking Scheme
            </button>
          </div>

          {/* Authentic Examination Paper Sheet */}
          <div className="exam-sheet">
            {/* University Header */}
            <div className="paper-univ-header">
              <h2 className="paper-univ-name">KALINGA INSTITUTE OF INDUSTRIAL TECHNOLOGY</h2>
              <div className="paper-univ-sub">Deemed to be University, Bhubaneswar - 751024, Odisha</div>
              <div className="paper-exam-title">
                {paperData.exam_title} {activeTab === "ans" ? "— SOLUTIONS & MARKING SCHEME" : ""}
              </div>
            </div>

            <div className="paper-double-divider"></div>

            {/* Meta Table */}
            <div className="paper-meta-grid">
              <div>
                <div><b>Subject:</b> {paperData.subject_name}</div>
                <div><b>Semester / Programme:</b> {paperData.semester || "B.Tech"}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div><b>Time:</b> {paperData.time_allowed}</div>
                <div><b>Full Marks:</b> {paperData.full_marks}</div>
              </div>
            </div>

            {/* Instructions Box */}
            <div className="paper-instructions-box">
              <b>Instructions:</b> {paperData.instructions}
            </div>

            {/* SECTION A: 1-MARK COMPULSORY QUESTIONS */}
            <div className="paper-section-title">
              {paperData.section_a?.title || "SECTION - A (Compulsory)"}
            </div>

            <div className="paper-sec-a-questions">
              {(paperData.section_a?.questions || []).map((q, idx) => (
                <div key={idx} className="paper-q-row">
                  <div className="paper-q-content">
                    <span className="paper-q-id">{q.id || `1(${String.fromCharCode(97 + idx)})`}.</span>
                    <MathRenderer text={q.question_text} />

                    {q.formula && (
                      <MathRenderer text={q.formula} isBlockFormula={true} />
                    )}

                    {/* Show Solution if activeTab === 'ans' */}
                    {activeTab === "ans" && q.solution && (
                      <div className="paper-sol-box">
                        <div className="sol-label">Solution:</div>
                        <ul className="sol-steps-list">
                          {(q.solution.steps || []).map((s, si) => (
                            <li key={si}>
                              <MathRenderer text={s} />
                            </li>
                          ))}
                        </ul>
                        {q.solution.final_answer && (
                          <div className="sol-final-ans">
                            <b>Answer:</b> <MathRenderer text={q.solution.final_answer} />
                          </div>
                        )}
                        {q.solution.marking_scheme && (
                          <span className="sol-rubric-badge">
                            Rubric: <MathRenderer text={q.solution.marking_scheme} />
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="paper-q-marks">[{q.marks || 1}]</div>
                </div>
              ))}
            </div>

            {/* SECTION B: LONG QUESTIONS */}
            <div className="paper-section-title" style={{ marginTop: 32 }}>
              {paperData.section_b?.title || "SECTION - B"}
            </div>
            {paperData.section_b?.instruction && (
              <div className="paper-section-note">
                <MathRenderer text={paperData.section_b.instruction} />
              </div>
            )}

            <div className="paper-sec-b-questions">
              {(paperData.section_b?.questions || []).map((lq, lidx) => (
                <div key={lidx} className="paper-long-q">
                  <div className="paper-long-q-head">
                    Q.{lq.question_number || lidx + 2}.
                  </div>

                  {(lq.sub_parts || []).map((sp, spidx) => (
                    <div key={spidx} className="paper-q-row paper-sub-part">
                      <div className="paper-q-content">
                        <span className="paper-q-id">{sp.part || `(${String.fromCharCode(97 + spidx)})`}</span>
                        <MathRenderer text={sp.question_text} />

                        {sp.formula && (
                          <MathRenderer text={sp.formula} isBlockFormula={true} />
                        )}

                        {/* Show Solution if activeTab === 'ans' */}
                        {activeTab === "ans" && sp.solution && (
                          <div className="paper-sol-box">
                            <div className="sol-label">Solution for {sp.part}:</div>
                            <ul className="sol-steps-list">
                              {(sp.solution.steps || []).map((s, si) => (
                                <li key={si}>
                                  <MathRenderer text={s} />
                                </li>
                              ))}
                            </ul>
                            {sp.solution.final_answer && (
                              <div className="sol-final-ans">
                                <b>Result / Conclusion:</b> <MathRenderer text={sp.solution.final_answer} />
                              </div>
                            )}
                            {sp.solution.marking_scheme && (
                              <span className="sol-rubric-badge">
                                Rubric: <MathRenderer text={sp.solution.marking_scheme} />
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="paper-q-marks">[{sp.marks}]</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="paper-end-notice">
              *** END OF EXAMINATION PAPER ***
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
