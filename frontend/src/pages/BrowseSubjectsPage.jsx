import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FileText, ChevronRight, BookOpen } from 'lucide-react';

export default function BrowseSubjectsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [semesters, setSemesters] = useState([]);
  const [selectedSem, setSelectedSem] = useState('');
  const [subjectsData, setSubjectsData] = useState([]);
  const [loading, setLoading] = useState(true);

  const semParam = searchParams.get('sem');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const url = semParam ? `/api/browse/?sem=${encodeURIComponent(semParam)}` : '/api/browse/';
        const res = await fetch(url);
        const data = await res.json();
        setSemesters(data.semesters || []);
        setSelectedSem(data.selected_sem || '');
        setSubjectsData(data.subjects_data || []);
      } catch (err) {
        console.error('Failed to load browse data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [semParam]);

  const handleSelectSem = (sem) => {
    setSearchParams({ sem });
  };

  return (
    <>
      <style>{`
        .browse-header h1 {
          font-family: var(--font-serif);
          font-size: 2rem;
          font-weight: 600;
          margin: 0 0 6px;
          color: #0f172a;
        }
        .browse-header p {
          color: var(--text-muted);
          font-size: 0.95rem;
          margin: 0 0 24px;
        }

        .sem-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 24px;
        }
        .sem-tab-btn {
          cursor: pointer;
          font-family: var(--font-sans);
          font-size: 0.85rem;
          font-weight: 600;
          padding: 8px 16px;
          border-radius: var(--radius-pill);
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.08);
          color: var(--text-muted);
          transition: all 0.15s ease;
          box-shadow: var(--shadow-sm);
        }
        .sem-tab-btn:hover {
          border-color: rgba(15, 23, 42, 0.2);
          color: var(--text-main);
        }
        .sem-tab-btn.active {
          background: #0d1117;
          color: #ffffff;
          border-color: #0d1117;
          box-shadow: 0 4px 12px rgba(13, 17, 23, 0.2);
        }

        .subject-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 16px;
        }
        .subject-card {
          display: block;
          padding: 20px 22px;
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.06);
          border-radius: 16px;
          box-shadow: var(--shadow-sm);
          transition: all 0.2s ease;
        }
        .subject-card:hover {
          border-color: rgba(37, 99, 235, 0.3);
          box-shadow: 0 10px 25px -4px rgba(15, 23, 42, 0.08);
          transform: translateY(-2px);
        }
        .subject-card .sem-label {
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          text-transform: uppercase;
        }
        .subject-card .name {
          font-family: var(--font-serif);
          font-weight: 600;
          font-size: 1.2rem;
          margin: 6px 0 12px;
          color: #0f172a;
          line-height: 1.3;
        }
        .subject-card .tags {
          display: flex;
          gap: 6px;
          margin-bottom: 14px;
          flex-wrap: wrap;
        }
        .subject-card .meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.8rem;
          color: var(--text-muted);
          padding-top: 10px;
          border-top: 1px solid rgba(15, 23, 42, 0.05);
        }
        .subject-card .meta-left {
          display: flex;
          align-items: center;
          gap: 6px;
        }
      `}</style>

      <div className="browse-header">
        <h1>Browse PYQ Archive</h1>
        <p>Select a semester and explore verified past exam papers and syllabus maps.</p>
      </div>

      <div className="sem-tabs">
        {semesters.map(sem => (
          <button
            key={sem}
            type="button"
            className={`sem-tab-btn ${sem === selectedSem ? 'active' : ''}`}
            onClick={() => handleSelectSem(sem)}
          >
            {sem}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading subjects…</p>
      ) : (
        <div className="subject-grid">
          {subjectsData.map(item => (
            <Link
              key={item.subject.id}
              className="plain subject-card"
              to={`/browse/subject/${item.subject.id}`}
            >
              <div className="sem-label">{item.subject.semester}</div>
              <div className="name">{item.subject.name}</div>
              <div className="tags">
                {item.exam_types.map(et => {
                  const tagClass = et === 'Midsem' ? 'blue' : (et === 'Endsem' ? 'green' : 'amber');
                  return (
                    <span key={et} className={`tag ${tagClass}`}>
                      {et.toLowerCase()}
                    </span>
                  );
                })}
              </div>
              <div className="meta">
                <div className="meta-left">
                  <FileText size={13} />
                  <span>{item.count} paper{item.count === 1 ? '' : 's'} · {item.year_range}</span>
                </div>
                <ChevronRight size={14} color="#94a3b8" />
              </div>
            </Link>
          ))}

          {subjectsData.length === 0 && (
            <p style={{ color: 'var(--text-muted)' }}>No subjects found for this semester.</p>
          )}
        </div>
      )}
    </>
  );
}
