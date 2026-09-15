import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

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
        .browse-header h1 { font-size: 1.5rem; margin: 0 0 4px; }
        .browse-header p { color: var(--text-soft); font-size: 0.9rem; margin: 0 0 20px; }

        .sem-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 22px; }
        .sem-tab-btn {
          cursor: pointer;
          font-family: inherit;
          text-decoration: none; font-size: 0.82rem; font-weight: 600; padding: 7px 16px;
          border-radius: 7px; background: var(--bg); border: 1px solid var(--border); color: var(--text-soft);
          transition: border-color 0.15s, color 0.15s;
        }
        .sem-tab-btn:hover { border-color: #c9ced6; color: var(--text); }
        .sem-tab-btn.active { background: var(--green); color: #fff; border-color: var(--green); }

        .subject-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; }
        .subject-card {
          display: block; padding: 16px 18px; transition: box-shadow 0.12s ease, transform 0.12s ease;
        }
        .subject-card:hover { box-shadow: 0 3px 10px rgba(0,0,0,0.06); transform: translateY(-1px); }
        .subject-card .sem-label { font-size: 0.68rem; font-weight: 600; letter-spacing: 0.04em; color: var(--text-soft); text-transform: uppercase; }
        .subject-card .name { font-weight: 600; font-size: 1.02rem; margin: 4px 0 9px; color: var(--text); }
        .subject-card .tags { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
        .subject-card .meta { display: flex; align-items: center; justify-content: space-between; font-size: 0.78rem; color: var(--text-soft); }
        .subject-card .chevron { color: #c1c6cf; }
      `}</style>

      <div className="browse-header">
        <h1>Browse PYQs</h1>
        <p>Select a semester and pick a subject to view past year questions.</p>
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
        <p style={{ color: 'var(--text-soft)' }}>Loading subjects…</p>
      ) : (
        <div className="subject-grid">
          {subjectsData.map(item => (
            <Link
              key={item.subject.id}
              className="plain card subject-card"
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
                <span>📄 {item.count} paper{item.count === 1 ? '' : 's'} · {item.year_range}</span>
                <span className="chevron">›</span>
              </div>
            </Link>
          ))}

          {subjectsData.length === 0 && (
            <p style={{ color: 'var(--text-soft)' }}>No subjects found for this semester.</p>
          )}
        </div>
      )}
    </>
  );
}
