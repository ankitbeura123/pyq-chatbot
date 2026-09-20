import { useEffect, useState } from "react";
import { BookOpen, Download, RotateCcw, FileText, Sparkles } from "lucide-react";
import CustomSelect from "../components/CustomSelect";

const GENERATE_ENDPOINT = "/api/notes/generate/";

export default function RevisionNotesPage() {
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notes, setNotes] = useState(null);
  const [pdfFilename, setPdfFilename] = useState(null);

  useEffect(() => {
    fetch("/api/subjects/")
      .then((res) => res.json())
      .then((data) => setSubjects(data.all_subjects || []))
      .catch(() => {});
  }, []);

  async function handleGenerate(e) {
    e.preventDefault();
    if (!topic.trim()) {
      setError("Please enter a topic name.");
      return;
    }
    setError(null);
    setLoading(true);
    setNotes(null);
    setPdfFilename(null);
    try {
      const res = await fetch(GENERATE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          subject_id: subjectId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate notes.");
      }
      setNotes(data.notes);
      setPdfFilename(data.pdf_filename);
    } catch (err) {
      setError(err.message || "Something went wrong generating the notes.");
    } finally {
      setLoading(false);
    }
  }

  function handleNewTopic() {
    setNotes(null);
    setPdfFilename(null);
    setTopic("");
    setError(null);
  }

  return (
    <div className="notes-page">
      {!notes && (
        <div className="notes-setup-card card">
          <h1 className="notes-title">
            <BookOpen size={22} color="#2563eb" />
            Generate Revision Notes
          </h1>
          <p className="notes-subtitle">
            Enter any topic name and generate structured, exam-ready revision notes —
            complete with key formulas, core terms, and exam tips.
          </p>

          <form onSubmit={handleGenerate} className="notes-form">
            <label className="notes-label" htmlFor="notes-subject">
              Subject (optional)
            </label>
            <CustomSelect
              id="notes-subject"
              value={subjectId}
              onChange={(val) => setSubjectId(val)}
              placeholder="— General / No specific subject —"
              options={[
                { value: "", label: "— General / No specific subject —" },
                ...subjects.map((s) => ({
                  value: s.id,
                  label: `${s.name} (${s.semester})`,
                }))
              ]}
            />

            <label className="notes-label" htmlFor="notes-topic">
              Topic Name
            </label>
            <input
              id="notes-topic"
              type="text"
              className="notes-text-input"
              placeholder="e.g. Binary Search Trees, 1st Law of Thermodynamics, TCP Congestion Control"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />

            {error && <div className="notes-error">{error}</div>}

            <button type="submit" className="hero-btn-dark" style={{ marginTop: 20, alignSelf: 'flex-start' }} disabled={loading}>
              <Sparkles size={15} />
              {loading ? "Generating Notes…" : "Generate Structured Notes"}
            </button>
          </form>
        </div>
      )}

      {loading && (
        <div className="notes-loading card">
          <p>Orchids AI is drafting exam notes and indexing formula breakdowns…</p>
        </div>
      )}

      {notes && (
        <div className="notes-result">
          <div className="notes-result-header card">
            <div>
              <h1 className="notes-title" style={{ fontSize: '1.9rem' }}>{notes.title}</h1>
              {notes.intro && <p className="notes-intro">{notes.intro}</p>}
            </div>
            <div className="notes-result-actions">
              {pdfFilename && (
                <a
                  className="hero-btn-dark"
                  href={`/notes/download/${pdfFilename}/`}
                  download
                >
                  <Download size={15} />
                  Download PDF
                </a>
              )}
              <button type="button" className="btn" onClick={handleNewTopic}>
                <RotateCcw size={14} />
                New Topic
              </button>
            </div>
          </div>

          {(notes.sections || []).map((section, idx) => (
            <div key={idx} className="notes-section-card card">
              <h2 className="notes-section-heading">{section.heading}</h2>
              <ul className="notes-bullet-list">
                {(section.body_points || []).map((pt, i) => (
                  <li key={i}>{pt}</li>
                ))}
              </ul>
              {(section.formulas || []).length > 0 && (
                <div className="notes-formula-block">
                  {section.formulas.map((f, i) => (
                    <code key={i} className="notes-formula-inline">
                      {f}
                    </code>
                  ))}
                </div>
              )}
            </div>
          ))}

          {(notes.key_terms || []).length > 0 && (
            <div className="notes-section-card card">
              <h2 className="notes-section-heading">Key Terms</h2>
              <dl className="notes-terms-list">
                {notes.key_terms.map((kt, i) => (
                  <div key={i} className="notes-term-row">
                    <dt>{kt.term}</dt>
                    <dd>{kt.definition}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {(notes.exam_tips || []).length > 0 && (
            <div className="notes-section-card card">
              <h2 className="notes-section-heading">Exam Tips</h2>
              <ul className="notes-bullet-list">
                {notes.exam_tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
