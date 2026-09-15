import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';

export default function BrowseDocumentsPage() {
  const { subjectId } = useParams();
  const [subject, setSubject] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [syllabus, setSyllabus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDocuments() {
      setLoading(true);
      try {
        const res = await fetch(`/api/browse/subject/${subjectId}/`);
        const data = await res.json();
        setSubject(data.subject);
        setDocuments(data.documents || []);
        setSyllabus(data.syllabus);
      } catch (err) {
        console.error('Failed to load documents:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDocuments();
  }, [subjectId]);

  if (loading) {
    return <p style={{ color: 'var(--text-soft)' }}>Loading documents…</p>;
  }

  if (!subject) {
    return <p style={{ color: 'var(--text-soft)' }}>Subject not found.</p>;
  }

  return (
    <>
      <style>{`
        .back-link { font-size: 0.82rem; color: var(--text-soft); text-decoration: none; display: inline-block; margin-bottom: 12px; }
        .back-link:hover { color: var(--text); }
        .subject-title { font-size: 1.3rem; font-weight: 700; margin: 0 0 4px; }
        .subject-sub { font-size: 0.85rem; color: var(--text-soft); margin-bottom: 16px; }
        .syllabus-note {
          background: var(--amber-soft); border: 1px solid #f3d98e; color: var(--amber-text);
          border-radius: 8px; padding: 10px 14px; font-size: 0.82rem; margin-bottom: 18px;
        }
        .doc-list { padding: 6px; }
        .doc-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 14px; border-radius: 8px; text-decoration: none; color: inherit;
          transition: background 0.15s;
        }
        .doc-row:hover { background: var(--bg-soft); }
        .doc-row + .doc-row { border-top: 1px solid var(--border); }
        .doc-main { display: flex; align-items: center; gap: 12px; }
        .doc-icon { color: var(--text-soft); }
        .doc-name { font-size: 0.9rem; font-weight: 500; color: var(--text); }
        .doc-tags { display: flex; gap: 6px; align-items: center; margin-top: 3px; }
        .doc-year { font-size: 0.76rem; color: var(--text-soft); }
        .doc-actions { display: flex; align-items: center; gap: 14px; }
        .doc-actions a { font-size: 0.78rem; color: var(--text-soft); text-decoration: none; }
        .doc-actions a:hover { color: var(--green); }
      `}</style>

      <Link className="back-link" to="/browse">
        ← All subjects
      </Link>
      <div className="subject-title">{subject.name}</div>
      <div className="subject-sub">
        {subject.semester} · {documents.length} paper{documents.length === 1 ? '' : 's'}
      </div>

      {syllabus && (
        <div className="syllabus-note">
          📘 Syllabus on file and indexed for this subject.
        </div>
      )}

      <div className="card doc-list">
        {documents.map(doc => (
          <a
            key={doc.id}
            className="doc-row"
            href={`/browse/document/${doc.id}/download/`}
          >
            <div className="doc-main">
              <span className="doc-icon">📄</span>
              <div>
                <div className="doc-name">{doc.file_name}</div>
                <div className="doc-tags">
                  {doc.year && <span className="doc-year">{doc.year}</span>}
                  {doc.exam_type === 'Midsem' ? (
                    <span className="tag blue">midsem</span>
                  ) : doc.exam_type === 'Endsem' ? (
                    <span className="tag green">endsem</span>
                  ) : doc.exam_type ? (
                    <span className="tag amber">{doc.exam_type.toLowerCase()}</span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="doc-actions">
              <Link
                to={`/browse/document/${doc.id}`}
                onClick={(e) => e.stopPropagation()}
              >
                Preview
              </Link>
              <span>⬇</span>
            </div>
          </a>
        ))}

        {documents.length === 0 && (
          <p style={{ color: 'var(--text-soft)', padding: '14px' }}>
            No documents found for this subject.
          </p>
        )}
      </div>
    </>
  );
}
