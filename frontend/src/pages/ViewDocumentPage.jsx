import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';

export default function ViewDocumentPage() {
  const { docId } = useParams();
  const [docData, setDocData] = useState(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDoc() {
      setLoading(true);
      try {
        const res = await fetch(`/api/browse/document/${docId}/`);
        const data = await res.json();
        setDocData(data.document);
        setText(data.text || '');
      } catch (err) {
        console.error('Failed to load document preview:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDoc();
  }, [docId]);

  if (loading) {
    return <p style={{ color: 'var(--text-soft)' }}>Loading document preview…</p>;
  }

  if (!docData) {
    return <p style={{ color: 'var(--text-soft)' }}>Document not found.</p>;
  }

  const subject = docData.subject;

  return (
    <>
      <style>{`
        .back-link { font-size: 0.82rem; color: var(--text-soft); text-decoration: none; display: inline-block; margin-bottom: 12px; }
        .back-link:hover { color: var(--text); }
        .doc-title { font-size: 1.15rem; font-weight: 700; margin: 0 0 4px; }
        .doc-meta { font-size: 0.82rem; color: var(--text-soft); margin-bottom: 16px; }
        .doc-meta a { color: var(--green); font-weight: 600; text-decoration: none; }
        .doc-body {
          padding: 22px; white-space: pre-wrap; font-size: 0.87rem; line-height: 1.7;
          max-height: 65vh; overflow-y: auto;
        }
      `}</style>

      {subject && (
        <Link className="back-link" to={`/browse/subject/${subject.id}`}>
          ← {subject.name}
        </Link>
      )}

      <div className="doc-title">{docData.file_name}</div>
      <div className="doc-meta">
        {docData.year || 'Year unknown'} · {docData.exam_type || 'Type unknown'} ·{' '}
        <a href={`/browse/document/${docData.id}/download/`}>Download ⬇</a>
      </div>

      <div className="card doc-body">{text}</div>
    </>
  );
}
