import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BookOpen, FileText, Download, ArrowLeft, Eye } from 'lucide-react';

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
    return <p style={{ color: 'var(--text-muted)' }}>Loading documents…</p>;
  }

  if (!subject) {
    return <p style={{ color: 'var(--text-muted)' }}>Subject not found.</p>;
  }

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
          transition: color 0.15s ease;
        }
        .back-link:hover { color: var(--text-main); }
        .subject-title {
          font-family: var(--font-serif);
          font-size: 1.8rem;
          font-weight: 600;
          margin: 0 0 6px;
          color: #0f172a;
        }
        .subject-sub {
          font-size: 0.9rem;
          color: var(--text-muted);
          margin-bottom: 20px;
        }
        .syllabus-note {
          background: #fef3c7;
          border: 1px solid #fde68a;
          color: #92400e;
          border-radius: 12px;
          padding: 12px 16px;
          font-size: 0.88rem;
          font-weight: 500;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .doc-list {
          padding: 8px;
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          box-shadow: var(--shadow-sm);
        }
        .doc-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-radius: 10px;
          text-decoration: none;
          color: inherit;
          transition: background 0.15s ease;
        }
        .doc-row:hover { background: #f8fafc; }
        .doc-row + .doc-row { border-top: 1px solid rgba(15, 23, 42, 0.06); }
        .doc-main { display: flex; align-items: center; gap: 14px; }
        .doc-icon { color: var(--accent-blue); display: flex; align-items: center; }
        .doc-name { font-size: 0.95rem; font-weight: 600; color: #0f172a; }
        .doc-tags { display: flex; gap: 8px; align-items: center; margin-top: 4px; }
        .doc-year { font-size: 0.8rem; color: var(--text-muted); }
        .doc-actions { display: flex; align-items: center; gap: 14px; }
        .doc-action-btn {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text-muted);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 12px;
          border-radius: var(--radius-sm);
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: #ffffff;
          transition: all 0.15s ease;
        }
        .doc-action-btn:hover {
          color: var(--text-main);
          border-color: rgba(15, 23, 42, 0.2);
          background: #f8fafc;
        }
      `}</style>

      <Link className="back-link" to="/browse">
        <ArrowLeft size={14} />
        All subjects
      </Link>
      <div className="subject-title">{subject.name}</div>
      <div className="subject-sub">
        {subject.semester} · {documents.length} paper{documents.length === 1 ? '' : 's'}
      </div>

      {syllabus && (
        <div className="syllabus-note">
          <BookOpen size={16} />
          <span>Syllabus on file and indexed for this subject.</span>
        </div>
      )}

      <div className="doc-list">
        {documents.map(doc => (
          <div key={doc.id} className="doc-row">
            <div className="doc-main">
              <div className="doc-icon">
                <FileText size={18} />
              </div>
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
                className="doc-action-btn"
                to={`/browse/document/${doc.id}`}
              >
                <Eye size={13} />
                Preview
              </Link>
              <a
                className="doc-action-btn"
                href={`/browse/document/${doc.id}/download/`}
                download
              >
                <Download size={13} />
                Download
              </a>
            </div>
          </div>
        ))}

        {documents.length === 0 && (
          <p style={{ color: 'var(--text-muted)', padding: '16px' }}>
            No documents found for this subject.
          </p>
        )}
      </div>
    </>
  );
}
