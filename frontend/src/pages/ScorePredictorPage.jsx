import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  CheckCircle2,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  Sparkles,
  BookOpen,
  Layers,
  Search,
  Award,
  RotateCcw,
  Flame,
  ArrowRight,
  Check,
  Percent,
  BarChart3,
  HelpCircle
} from 'lucide-react';
import CustomSelect from '../components/CustomSelect';

// Tri-state checkbox for Unit-level selection (Checked, Unchecked, Indeterminate)
function UnitCheckbox({ checked, indeterminate, onChange, id }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = Boolean(indeterminate);
    }
  }, [indeterminate]);

  return (
    <input
      type="checkbox"
      id={id}
      ref={ref}
      checked={Boolean(checked)}
      onChange={onChange}
      style={{
        width: 18,
        height: 18,
        accentColor: '#2563eb',
        cursor: 'pointer',
        flexShrink: 0
      }}
    />
  );
}

export default function ScorePredictorPage() {
  const [subjectsBySemester, setSubjectsBySemester] = useState({});
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedSubjectName, setSelectedSubjectName] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [units, setUnits] = useState([]);
  const [topics, setTopics] = useState([]);
  const [studiedTopics, setStudiedTopics] = useState([]);
  const [collapsedUnits, setCollapsedUnits] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [breakdownFilter, setBreakdownFilter] = useState('all'); // 'all' | 'studied' | 'unstudied'
  const [predictionResult, setPredictionResult] = useState(null);
  const [predicting, setPredicting] = useState(false);

  const resultRef = useRef(null);

  useEffect(() => {
    async function loadSubjects() {
      try {
        const res = await fetch('/api/subjects/');
        const data = await res.json();
        setSubjectsBySemester(data.subjects_by_semester || {});
      } catch (err) {
        console.error('Failed to load subjects:', err);
      }
    }
    loadSubjects();
  }, []);

  const handleSemesterChange = (val) => {
    const sem = typeof val === 'object' && val?.target ? val.target.value : val;
    setSelectedSemester(sem);
    setSelectedSubjectId('');
    setSelectedSubjectName('');
    setUnits([]);
    setTopics([]);
    setStudiedTopics([]);
    setPredictionResult(null);
    setStatusMsg('');
  };

  const handleSubjectChange = async (val) => {
    const id = typeof val === 'object' && val?.target ? val.target.value : val;
    setSelectedSubjectId(id);
    setUnits([]);
    setTopics([]);
    setStudiedTopics([]);
    setPredictionResult(null);
    setSearchQuery('');

    if (!id) {
      setSelectedSubjectName('');
      setStatusMsg('');
      return;
    }

    const available = selectedSemester ? subjectsBySemester[selectedSemester] || [] : [];
    const subj = available.find(s => String(s.id) === String(id));
    if (subj) setSelectedSubjectName(subj.name);

    setStatusMsg('Loading syllabus units and topic frequencies…');

    try {
      const res = await fetch(`/api/predict/topics/${id}/`);
      const data = await res.json();

      let unitList = data.units || [];
      const topicList = data.topics || [];

      // Fallback: If no structured units returned, construct from topics
      if (!unitList.length && topicList.length) {
        const grouped = {};
        topicList.forEach(t => {
          const uName = t.unit || 'Unit 1';
          if (!grouped[uName]) {
            grouped[uName] = {
              unit: uName,
              title: t.unit_title || '',
              label: t.unit_title ? `${uName}: ${t.unit_title}` : uName,
              weight_pct: 0,
              total_questions: 0,
              topics: []
            };
          }
          grouped[uName].topics.push(t);
          grouped[uName].weight_pct += t.weight_pct || 0;
          grouped[uName].total_questions += t.count || 0;
        });
        unitList = Object.values(grouped);
      }

      if (!unitList.length && !topicList.length) {
        setStatusMsg('No syllabus or PYQ topics found for this subject yet.');
        return;
      }

      // Collect all flat topics from units if topicList is empty
      const allExtractedTopics = [];
      unitList.forEach(u => {
        (u.topics || []).forEach(t => {
          allExtractedTopics.push({
            name: t.name || t.topic,
            topic: t.name || t.topic,
            count: t.count || 0,
            weight_pct: t.weight_pct || 0,
            unit: u.unit || t.unit || '',
            unit_title: u.title || t.unit_title || ''
          });
        });
      });

      const finalTopics = topicList.length ? topicList : allExtractedTopics;

      setUnits(unitList);
      setTopics(finalTopics);
      setStatusMsg(`${unitList.length} Units · ${finalTopics.length} Topics mapped from syllabus & PYQ trends.`);
    } catch (err) {
      setStatusMsg(`Failed to load topics: ${err.message}`);
    }
  };

  // Toggle individual topic
  const handleTopicToggle = (topicName) => {
    setStudiedTopics(prev =>
      prev.includes(topicName)
        ? prev.filter(t => t !== topicName)
        : [...prev, topicName]
    );
  };

  // Toggle entire unit checkbox: If all selected -> unselect all; Else -> select all
  const handleUnitToggle = (unit) => {
    const unitTopicNames = (unit.topics || []).map(t => t.name || t.topic);
    if (!unitTopicNames.length) return;

    const allSelected = unitTopicNames.every(name => studiedTopics.includes(name));

    if (allSelected) {
      // Unselect all in this unit
      setStudiedTopics(prev => prev.filter(name => !unitTopicNames.includes(name)));
    } else {
      // Select all in this unit
      setStudiedTopics(prev => {
        const next = new Set(prev);
        unitTopicNames.forEach(name => next.add(name));
        return Array.from(next);
      });
    }
  };

  // Global bulk actions
  const handleSelectAll = () => {
    const allNames = topics.map(t => t.name || t.topic);
    setStudiedTopics(allNames);
  };

  const handleDeselectAll = () => {
    setStudiedTopics([]);
  };

  const toggleUnitCollapse = (unitName) => {
    setCollapsedUnits(prev => ({
      ...prev,
      [unitName]: !prev[unitName]
    }));
  };

  const handleExpandAll = () => setCollapsedUnits({});
  const handleCollapseAll = () => {
    const collapsed = {};
    units.forEach(u => {
      collapsed[u.unit] = true;
    });
    setCollapsedUnits(collapsed);
  };

  // Predict API call
  const handlePredict = async () => {
    if (!selectedSubjectId || predicting) return;
    setPredicting(true);

    try {
      const res = await fetch('/api/predict/score/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject_id: selectedSubjectId,
          studied_topics: studiedTopics,
          total_marks: 50
        })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }

      setPredictionResult(data);
      setTimeout(() => {
        if (resultRef.current) {
          resultRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } catch (err) {
      alert(`Prediction failed: ${err.message}`);
    } finally {
      setPredicting(false);
    }
  };

  const availableSubjects = selectedSemester
    ? subjectsBySemester[selectedSemester] || []
    : [];

  // Filter units and topics by search query
  const filteredUnits = units.map(u => {
    const uTopics = u.topics || [];
    if (!searchQuery.trim()) return u;

    const q = searchQuery.toLowerCase();
    const matchesUnit = (u.unit && u.unit.toLowerCase().includes(q)) || (u.title && u.title.toLowerCase().includes(q));
    const matchingTopics = uTopics.filter(t => (t.name || t.topic || '').toLowerCase().includes(q));

    if (matchesUnit) return u;
    if (matchingTopics.length > 0) {
      return { ...u, topics: matchingTopics };
    }
    return null;
  }).filter(Boolean);

  const totalTopicsCount = topics.length;
  const selectedTopicsCount = studiedTopics.length;
  const preparednessPct = totalTopicsCount ? Math.round((selectedTopicsCount / totalTopicsCount) * 100) : 0;

  // Grade classification helper
  const getGradeTier = (score, total) => {
    const pct = total ? (score / total) * 100 : 0;
    if (pct >= 90) return { grade: 'O (Outstanding)', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', desc: 'Top 10% percentile range. Excellent coverage!' };
    if (pct >= 80) return { grade: 'E (Excellent)', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', desc: 'Distinction zone. Strong command across core units.' };
    if (pct >= 70) return { grade: 'A (Very Good)', color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe', desc: 'Solid passing margin. Revise high-weight topics to cross 80%.' };
    if (pct >= 60) return { grade: 'B (Good)', color: '#d97706', bg: '#fffbeb', border: '#fde68a', desc: 'Moderate coverage. Focus on high-probability questions.' };
    if (pct >= 50) return { grade: 'C (Pass)', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', desc: 'Borderline range. Prepare at least 2 complete units.' };
    return { grade: 'Needs Revision', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', desc: 'High risk zone. Select and study key topics below.' };
  };

  // Recommendations: top unstudied topics sorted by weight_pct
  const recommendedTopics = (predictionResult?.breakdown || [])
    .filter(b => !b.studied && b.weight_pct > 0)
    .slice(0, 3);

  return (
    <>
      <style>{`
        .sp-container {
          display: flex;
          flex-direction: column;
          gap: 22px;
          max-width: 1080px;
          margin: 0 auto;
        }

        .sp-header-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--accent-blue);
          background: rgba(37, 99, 235, 0.08);
          border: 1px solid rgba(37, 99, 235, 0.18);
          padding: 4px 12px;
          border-radius: var(--radius-pill);
          margin-bottom: 10px;
        }

        .sp-card {
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 18px;
          box-shadow: var(--shadow-sm);
          backdrop-filter: blur(16px);
          transition: all 0.2s ease;
          position: relative;
          z-index: 1;
        }

        .sp-selector-card {
          position: relative;
          z-index: 50;
        }

        .sp-content-card {
          position: relative;
          z-index: 1;
        }

        .unit-card {
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.09);
          border-radius: 14px;
          overflow: hidden;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .unit-card:hover {
          border-color: rgba(37, 99, 235, 0.3);
          box-shadow: 0 4px 16px -4px rgba(37, 99, 235, 0.08);
        }

        .unit-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          background: #f8fafc;
          border-bottom: 1px solid rgba(15, 23, 42, 0.06);
          cursor: pointer;
          user-select: none;
          gap: 12px;
          transition: background-color 0.15s ease;
        }

        .unit-header-row:hover {
          background: #f1f5f9;
        }

        .unit-badge {
          display: inline-flex;
          align-items: center;
          padding: 3px 9px;
          border-radius: 6px;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          background: #e0e7ff;
          color: #3730a3;
        }

        .topic-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 11px 16px;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s ease;
          border: 1px solid transparent;
          user-select: none;
        }

        .topic-row:hover {
          background: #f8fafc;
          border-color: rgba(15, 23, 42, 0.06);
        }

        .topic-row.checked {
          background: #eff6ff;
          border-color: #bfdbfe;
        }

        .topic-weight-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 6px;
          white-space: nowrap;
        }

        .topic-weight-chip.high {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .topic-weight-chip.med {
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }

        .topic-weight-chip.standard {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }

        .quick-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          font-size: 0.8rem;
          font-weight: 600;
          color: #334155;
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.12);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .quick-action-btn:hover {
          background: #f8fafc;
          border-color: #94a3b8;
          color: #0f172a;
        }

        .search-input-wrap {
          position: relative;
          flex: 1;
          min-width: 200px;
        }

        .search-input-wrap input {
          width: 100%;
          padding: 7px 12px 7px 32px;
          font-size: 0.84rem;
          border-radius: 8px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: #ffffff;
          outline: none;
          transition: all 0.15s ease;
        }

        .search-input-wrap input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .search-input-wrap .search-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
        }

        .unit-progress-bar {
          height: 6px;
          border-radius: 999px;
          background: #e2e8f0;
          overflow: hidden;
        }

        .unit-progress-fill {
          height: 100%;
          border-radius: 999px;
          transition: width 0.3s ease;
        }
      `}</style>

      <div className="sp-container">
        {/* Top Control Card */}
        <div className="sp-card sp-selector-card" style={{ padding: 26, zIndex: 50 }}>
          <div className="sp-header-tag">
            <Sparkles size={13} />
            <span>AI Weighted Score Predictor</span>
          </div>

          <h2 style={{ fontFamily: "var(--font-serif)", margin: '0 0 8px', fontSize: 28, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
            <TrendingUp size={26} color="#2563eb" />
            Unit-Wise Score Predictor
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13.5, margin: '0 0 20px', lineHeight: 1.55 }}>
            Check the units and topics you have prepared. Select an entire unit with one click, or customize topic-by-topic.
            Your predicted marks (out of 50) are dynamically weighted based on KIIT syllabus frequency and historical PYQ patterns.
          </p>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200, flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Semester
              </label>
              <CustomSelect
                id="semesterSelect"
                value={selectedSemester}
                onChange={handleSemesterChange}
                placeholder="Select semester…"
                options={Object.keys(subjectsBySemester).map(sem => ({ value: sem, label: sem }))}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 280, flex: 2 }}>
              <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Subject
              </label>
              <CustomSelect
                id="subjectSelect"
                disabled={!selectedSemester}
                value={selectedSubjectId}
                onChange={handleSubjectChange}
                placeholder={selectedSemester ? 'Select subject…' : 'Select semester first…'}
                options={availableSubjects.map(s => ({ value: s.id, label: s.name }))}
              />
            </div>
          </div>

          {statusMsg && (
            <div id="statusMsg" style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers size={14} color="#2563eb" />
              <span>{statusMsg}</span>
            </div>
          )}
        </div>

        {/* Unit & Topic Checklist Section */}
        {units.length > 0 && (
          <div id="topicWrap" className="sp-card sp-content-card" style={{ padding: 26, zIndex: 1 }}>
            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid rgba(15, 23, 42, 0.08)' }}>
              <div>
                <h3 style={{ fontSize: 17, margin: 0, fontFamily: "var(--font-serif)", color: '#0f172a' }}>
                  Select Prepared Topics
                </h3>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
                  <strong style={{ color: '#2563eb' }}>{selectedTopicsCount}</strong> of {totalTopicsCount} topics selected ({preparednessPct}% syllabus)
                </div>
              </div>

              {/* Quick action buttons & Search */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="search-input-wrap">
                  <Search size={14} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search topics / units…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <button type="button" className="quick-action-btn" onClick={handleSelectAll} title="Select all topics across all units">
                  <CheckSquare size={13} color="#2563eb" />
                  Select All
                </button>
                <button type="button" className="quick-action-btn" onClick={handleDeselectAll} title="Clear all selections">
                  <Square size={13} color="#64748b" />
                  Clear All
                </button>
                <button type="button" className="quick-action-btn" onClick={handleExpandAll} title="Expand all unit cards">
                  <ChevronDown size={13} />
                  Expand All
                </button>
                <button type="button" className="quick-action-btn" onClick={handleCollapseAll} title="Collapse all unit cards">
                  <ChevronRight size={13} />
                  Collapse All
                </button>
              </div>
            </div>

            {/* Units Hierarchy List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {filteredUnits.map((u, uIdx) => {
                const unitTopics = u.topics || [];
                const unitTopicNames = unitTopics.map(t => t.name || t.topic);
                const selectedInUnit = unitTopicNames.filter(name => studiedTopics.includes(name));
                const isAllUnitSelected = unitTopicNames.length > 0 && selectedInUnit.length === unitTopicNames.length;
                const isSomeUnitSelected = selectedInUnit.length > 0 && !isAllUnitSelected;
                const isCollapsed = Boolean(collapsedUnits[u.unit]);
                const unitWeight = u.weight_pct || 0;

                return (
                  <div key={u.unit || uIdx} className="unit-card">
                    {/* Unit Header with Unit-Level Checkbox */}
                    <div
                      className="unit-header-row"
                      onClick={(e) => {
                        // Don't toggle collapse if clicking the checkbox input directly
                        if (e.target.type !== 'checkbox' && e.target.tagName !== 'LABEL') {
                          toggleUnitCollapse(u.unit);
                        }
                      }}
                    >
                      {/* Left: Checkbox + Unit Name + Title */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 220 }}>
                        <div
                          style={{ display: 'flex', alignItems: 'center' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <UnitCheckbox
                            id={`unit-cb-${uIdx}`}
                            checked={isAllUnitSelected}
                            indeterminate={isSomeUnitSelected}
                            onChange={() => handleUnitToggle(u)}
                          />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span className="unit-badge">
                            {u.unit}
                          </span>
                          <span style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>
                            {u.title || u.label || u.unit}
                          </span>
                        </div>
                      </div>

                      {/* Right: Weightage badge + Prepared count + Collapse chevron */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        {unitWeight > 0 && (
                          <span className="topic-weight-chip med" title="Exam weightage from past papers">
                            {unitWeight}% weight
                          </span>
                        )}

                        <span style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: isAllUnitSelected ? '#ecfdf5' : isSomeUnitSelected ? '#eff6ff' : '#f1f5f9',
                          color: isAllUnitSelected ? '#047857' : isSomeUnitSelected ? '#1d4ed8' : '#64748b'
                        }}>
                          {selectedInUnit.length} / {unitTopicNames.length} prepared
                        </span>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            color: '#64748b'
                          }}
                        >
                          {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>
                    </div>

                    {/* Collapsible Topic Checklist for this Unit */}
                    {!isCollapsed && (
                      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6, background: '#ffffff' }}>
                        {unitTopics.length === 0 ? (
                          <div style={{ color: 'var(--text-muted)', fontSize: 12.5, padding: '8px 12px' }}>
                            No specific syllabus topics listed under this unit.
                          </div>
                        ) : (
                          unitTopics.map((t, tIdx) => {
                            const topicName = t.name || t.topic;
                            const isChecked = studiedTopics.includes(topicName);
                            const tWeight = t.weight_pct || 0;
                            const tCount = t.count || 0;

                            const weightClass = tWeight >= 10 ? 'high' : tWeight >= 5 ? 'med' : 'standard';

                            return (
                              <div
                                key={topicName || tIdx}
                                className={`topic-row ${isChecked ? 'checked' : ''}`}
                                onClick={() => handleTopicToggle(topicName)}
                              >
                                <input
                                  type="checkbox"
                                  value={topicName}
                                  checked={isChecked}
                                  onChange={() => {}} // handled by row onClick
                                  style={{
                                    accentColor: '#2563eb',
                                    cursor: 'pointer',
                                    width: 16,
                                    height: 16,
                                    flexShrink: 0
                                  }}
                                />

                                <div style={{ flex: 1, fontSize: 13.5, color: isChecked ? '#1d4ed8' : '#1e293b', fontWeight: isChecked ? 600 : 400, lineHeight: 1.4 }}>
                                  {topicName}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                  {tWeight > 0 ? (
                                    <span className={`topic-weight-chip ${weightClass}`}>
                                      {tWeight}% exam weight
                                    </span>
                                  ) : (
                                    <span className="topic-weight-chip standard" style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                      Syllabus topic
                                    </span>
                                  )}

                                  {tCount > 0 && (
                                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                      ({tCount} PYQs)
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Predict Trigger Bar */}
            <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid rgba(15, 23, 42, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                <strong>{selectedTopicsCount} topics</strong> selected across <strong>{units.filter(u => (u.topics || []).some(t => studiedTopics.includes(t.name || t.topic))).length} units</strong>.
              </div>

              <button
                id="predictBtn"
                className="hero-btn-dark"
                onClick={handlePredict}
                disabled={predicting || selectedTopicsCount === 0}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 22px',
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  opacity: selectedTopicsCount === 0 ? 0.6 : 1
                }}
              >
                <TrendingUp size={16} />
                {predicting ? 'Calculating Historical Probability…' : 'Calculate Predicted Score'}
              </button>
            </div>
          </div>
        )}

        {/* Prediction Results & Analytics Display */}
        {predictionResult && (
          <div ref={resultRef} id="resultWrap" className="sp-card sp-content-card" style={{ padding: 30, zIndex: 1 }}>
            {/* Score Overview Header */}
            {(() => {
              const tier = getGradeTier(predictionResult.predicted_score, predictionResult.total_marks);
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 20,
                    background: tier.bg,
                    border: `1px solid ${tier.border}`,
                    borderRadius: 16,
                    padding: '24px 28px'
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: tier.color, marginBottom: 4 }}>
                        Weighted Exam Readiness Forecast
                      </div>
                      <div style={{ fontFamily: "var(--font-serif)", fontSize: 46, fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>
                        <span>{predictionResult.predicted_score}</span>
                        <span style={{ color: '#64748b', fontSize: 26, fontWeight: 500 }}> / {predictionResult.total_marks}</span>
                        <span style={{ fontSize: 22, color: tier.color, marginLeft: 14, fontWeight: 600 }}>
                          ({Math.round((predictionResult.predicted_score / predictionResult.total_marks) * 100)}%)
                        </span>
                      </div>
                      <div style={{ color: '#334155', fontSize: 13.5, marginTop: 8, fontWeight: 500 }}>
                        Expected Grade Band: <strong style={{ color: tier.color }}>{tier.grade}</strong> · {tier.desc}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Syllabus Preparedness</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>
                        {predictionResult.coverage_pct}%
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {studiedTopics.length} of {topics.length} topics checked
                      </div>
                    </div>
                  </div>

                  {/* Recommendations Callout */}
                  {recommendedTopics.length > 0 && (
                    <div style={{
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: 14,
                      padding: '16px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700, color: '#b45309' }}>
                        <Flame size={16} color="#d97706" />
                        High-Impact Score Boosters (Prepare these next):
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {recommendedTopics.map((rt, i) => (
                          <div
                            key={i}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #fcd34d',
                              borderRadius: 8,
                              padding: '6px 12px',
                              fontSize: 12.5,
                              color: '#78350f',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>{rt.topic}</span>
                            <span style={{ background: '#fef3c7', padding: '1px 6px', borderRadius: 4, fontWeight: 700, color: '#92400e', fontSize: 11 }}>
                              +{rt.weight_pct}% weight (~{Math.round((rt.weight_pct / 100) * 50 * 10) / 10} marks)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Unit-Wise Score Contribution Grid */}
                  {predictionResult.unit_breakdown && predictionResult.unit_breakdown.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <h4 style={{ fontSize: 16, margin: '0 0 14px', fontFamily: "var(--font-serif)", color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <BarChart3 size={17} color="#2563eb" />
                        Unit-by-Unit Score Distribution
                      </h4>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                        {predictionResult.unit_breakdown.map((ub, idx) => {
                          const unitPct = ub.max_marks > 0 ? Math.min(100, Math.round((ub.scored_marks / ub.max_marks) * 100)) : 0;
                          const fillColor = unitPct >= 80 ? '#059669' : unitPct >= 50 ? '#2563eb' : unitPct > 0 ? '#f59e0b' : '#94a3b8';

                          return (
                            <div
                              key={idx}
                              style={{
                                background: '#f8fafc',
                                border: '1px solid rgba(15, 23, 42, 0.08)',
                                borderRadius: 12,
                                padding: '14px 16px'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                                  {ub.unit}
                                </span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: fillColor }}>
                                  {ub.scored_marks} <span style={{ color: '#64748b', fontWeight: 400 }}>/ {ub.max_marks} marks</span>
                                </span>
                              </div>

                              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ub.title}>
                                {ub.title || ub.label}
                              </div>

                              <div className="unit-progress-bar">
                                <div
                                  className="unit-progress-fill"
                                  style={{ width: `${unitPct}%`, background: fillColor }}
                                />
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginTop: 6 }}>
                                <span>{ub.studied_topics_count} of {ub.total_topics} topics</span>
                                <span>{unitPct}% prepared</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Detailed Topic Breakdown with Filters */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                      <h4 style={{ fontSize: 16, margin: 0, fontFamily: "var(--font-serif)", color: '#0f172a' }}>
                        Topic-Level Contribution Breakdown
                      </h4>

                      {/* Filter tabs */}
                      <div style={{ display: 'flex', gap: 6, background: '#f1f5f9', padding: 3, borderRadius: 8 }}>
                        <button
                          type="button"
                          onClick={() => setBreakdownFilter('all')}
                          style={{
                            padding: '4px 10px',
                            fontSize: 12,
                            fontWeight: 600,
                            borderRadius: 6,
                            border: 'none',
                            cursor: 'pointer',
                            background: breakdownFilter === 'all' ? '#ffffff' : 'transparent',
                            color: breakdownFilter === 'all' ? '#0f172a' : '#64748b',
                            boxShadow: breakdownFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                          }}
                        >
                          All ({predictionResult.breakdown?.length || 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => setBreakdownFilter('studied')}
                          style={{
                            padding: '4px 10px',
                            fontSize: 12,
                            fontWeight: 600,
                            borderRadius: 6,
                            border: 'none',
                            cursor: 'pointer',
                            background: breakdownFilter === 'studied' ? '#ffffff' : 'transparent',
                            color: breakdownFilter === 'studied' ? '#059669' : '#64748b',
                            boxShadow: breakdownFilter === 'studied' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                          }}
                        >
                          Prepared ({predictionResult.breakdown?.filter(b => b.studied).length || 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => setBreakdownFilter('unstudied')}
                          style={{
                            padding: '4px 10px',
                            fontSize: 12,
                            fontWeight: 600,
                            borderRadius: 6,
                            border: 'none',
                            cursor: 'pointer',
                            background: breakdownFilter === 'unstudied' ? '#ffffff' : 'transparent',
                            color: breakdownFilter === 'unstudied' ? '#dc2626' : '#64748b',
                            boxShadow: breakdownFilter === 'unstudied' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                          }}
                        >
                          Unprepared ({predictionResult.breakdown?.filter(b => !b.studied).length || 0})
                        </button>
                      </div>
                    </div>

                    <div id="breakdownList" style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 400, overflowY: 'auto', paddingRight: 4 }}>
                      {(predictionResult.breakdown || [])
                        .filter(b => {
                          if (breakdownFilter === 'studied') return b.studied;
                          if (breakdownFilter === 'unstudied') return !b.studied;
                          return true;
                        })
                        .map((b, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: 13,
                              padding: '10px 14px',
                              borderRadius: 10,
                              background: b.studied ? '#f0fdf4' : '#ffffff',
                              border: b.studied ? '1px solid #bbf7d0' : '1px solid rgba(15, 23, 42, 0.08)'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 200 }}>
                              <span style={{
                                width: 20,
                                height: 20,
                                borderRadius: 6,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: b.studied ? '#dcfce7' : '#f1f5f9',
                                color: b.studied ? '#16a34a' : '#94a3b8'
                              }}>
                                {b.studied ? <Check size={12} strokeWidth={3} /> : <span style={{ fontSize: 11 }}>—</span>}
                              </span>

                              <div>
                                <span style={{ color: b.studied ? '#15803d' : '#334155', fontWeight: b.studied ? 600 : 400 }}>
                                  {b.topic}
                                </span>
                                {b.unit && (
                                  <span style={{ marginLeft: 8, fontSize: 11, color: '#94a3b8', background: '#f8fafc', padding: '1px 6px', borderRadius: 4, border: '1px solid #e2e8f0' }}>
                                    {b.unit}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                              <span className="topic-weight-chip standard" style={{ fontSize: '0.72rem' }}>
                                {b.weight_pct}% weight
                              </span>

                              <span style={{ fontWeight: 700, fontSize: 13, color: b.studied ? '#16a34a' : '#94a3b8', minWidth: 80, textAlign: 'right' }}>
                                {b.studied ? `+${b.marks_contribution} marks` : '0.0 marks'}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </>
  );
}
