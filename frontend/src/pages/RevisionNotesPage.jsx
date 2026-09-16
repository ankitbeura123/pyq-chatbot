import { useEffect, useState } from "react";

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
                <div className="notes-setup-card glass-card">
                    <h1 className="notes-title">📘 Generate Revision Notes</h1>
                    <p className="notes-subtitle">
                        Type any topic name and get structured, exam-ready revision notes —
                        complete with formulas and diagrams — as a downloadable PDF.
                    </p>

                    <form onSubmit={handleGenerate} className="notes-form">
                        <label className="notes-label" htmlFor="notes-subject">
                            Subject (optional, improves context)
                        </label>
                        <select
                            id="notes-subject"
                            className="notes-select"
                            value={subjectId}
                            onChange={(e) => setSubjectId(e.target.value)}
                        >
                            <option value="">— No specific subject —</option>
                            {subjects.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name} ({s.semester})
                                </option>
                            ))}
                        </select>

                        <label className="notes-label" htmlFor="notes-topic">
                            Topic name
                        </label>
                        <input
                            id="notes-topic"
                            type="text"
                            className="notes-text-input"
                            placeholder="e.g. Binary Search Trees, Thermodynamics — First Law, TCP Congestion Control"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                        />

                        {error && <div className="notes-error">{error}</div>}

                        <button type="submit" className="notes-btn notes-btn-primary" disabled={loading}>
                            {loading ? "Generating notes…" : "Generate Notes"}
                        </button>
                    </form>
                </div>
            )}

            {loading && (
                <div className="notes-loading glass-card">
                    <p>Gemini is drafting your notes and rendering formulas/diagrams — this can take a bit.</p>
                </div>
            )}

            {notes && (
                <div className="notes-result">
                    <div className="notes-result-header glass-card">
                        <div>
                            <h1 className="notes-title">{notes.title}</h1>
                            {notes.intro && <p className="notes-intro">{notes.intro}</p>}
                        </div>
                        <div className="notes-result-actions">
                            {pdfFilename && (
                                <a
                                    className="notes-btn notes-btn-primary"
                                    href={`/notes/download/${pdfFilename}/`}
                                    download
                                >
                                    ⬇ Download PDF
                                </a>
                            )}
                            <button type="button" className="notes-btn notes-btn-secondary" onClick={handleNewTopic}>
                                New Topic
                            </button>
                        </div>
                    </div>

                    {(notes.sections || []).map((section, idx) => (
                        <div key={idx} className="notes-section-card glass-card">
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
                        <div className="notes-section-card glass-card">
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
                        <div className="notes-section-card glass-card">
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
