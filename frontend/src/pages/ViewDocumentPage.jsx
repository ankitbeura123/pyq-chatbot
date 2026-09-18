import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';

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
    return <p style={{ color: 'var(--text-muted)' }}>Loading document preview…</p>;
  }

  if (!docData) {
    return <p style={{ color: 'var(--text-muted)' }}>Document not found.</p>;
  }

  const subject = docData.subject;

  return (
    <>
      <style>{`
        .back-link {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-muted);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 16px;
        }
        .back-link:hover { color: var(--text-main); }
        .doc-title {
          font-family: var(--font-serif);
          font-size: 1.6rem;
          font-weight: 600;
          margin: 0 0 6px;
          color: #0f172a;
        }
        .doc-meta {
          font-size: 0.88rem;
          color: var(--text-muted);
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .doc-meta a {
          color: var(--accent-blue);
          font-weight: 600;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .doc-body {
          padding: 24px;
          white-space: pre-wrap;
          font-size: 0.92rem;
          line-height: 1.7;
          max-height: 65vh;
          overflow-y: auto;
          color: #334155;
          background: #ffffff;
        }
      `}</style>

      {subject && (
        <Link className="back-link" to={`/browse/subject/${subject.id}`}>
          <ArrowLeft size={14} />
          {subject.name}
        </Link>
      )}

      <div className="doc-title">{docData.file_name}</div>
      <div className="doc-meta">
        <span>{docData.year || 'Year unknown'} · {docData.exam_type || 'Type unknown'}</span>
        <span>·</span>
        <a href={`/browse/document/${docData.id}/download/`} download>
          <Download size={14} />
          Download Paper
        </a>
      </div>

      <div className="card doc-body">{text}</div>
    </>
  );
}
