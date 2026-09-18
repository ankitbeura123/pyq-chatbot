import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, CheckCircle, Award } from 'lucide-react';

export default function ScorePredictorPage() {
  const [subjectsBySemester, setSubjectsBySemester] = useState({});
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [topics, setTopics] = useState([]);
  const [studiedTopics, setStudiedTopics] = useState([]);
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

  const handleSemesterChange = (e) => {
    const sem = e.target.value;
    setSelectedSemester(sem);
    setSelectedSubjectId('');
    setTopics([]);
    setStudiedTopics([]);
    setPredictionResult(null);
    setStatusMsg('');
  };

  const handleSubjectChange = async (e) => {
    const id = e.target.value;
    setSelectedSubjectId(id);
    setTopics([]);
    setStudiedTopics([]);
    setPredictionResult(null);

    if (!id) {
      setStatusMsg('');
      return;
    }

    setStatusMsg('Loading topics from historical question index…');

    try {
      const res = await fetch(`/api/predict/topics/${id}/`);
      const data = await res.json();

      if (!data.topics || !data.topics.length) {
        setStatusMsg('No tagged topics found for this subject yet.');
        return;
      }

      setStatusMsg(`${data.topics.length} topics extracted from past papers.`);
      setTopics(data.topics);
    } catch (err) {
      setStatusMsg(`Failed to load topics: ${err.message}`);
    }
  };

  const handleTopicToggle = (topicName) => {
    setStudiedTopics(prev =>
      prev.includes(topicName)
        ? prev.filter(t => t !== topicName)
        : [...prev, topicName]
    );
  };

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

  return (
    <>
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontFamily: "var(--font-serif)", margin: '0 0 10px', fontSize: 26, display: 'flex', alignItems: 'center', gap: 10, color: '#0f172a' }}>
          <TrendingUp size={22} color="#2563eb" />
          Score Predictor
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 18px', lineHeight: 1.5 }}>
          Select the topics you have thoroughly revised. Your predicted score is weighted according to historical question repetition and syllabus distribution — calculated out of 50 marks.
        </p>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Semester
            </label>
            <select
              id="semesterSelect"
              className="styled-select"
              value={selectedSemester}
              onChange={handleSemesterChange}
            >
              <option value="">Select semester…</option>
              {Object.keys(subjectsBySemester).map(sem => (
                <option key={sem} value={sem}>{sem}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Subject
            </label>
            <select
              id="subjectSelect"
              className="styled-select"
              disabled={!selectedSemester}
              value={selectedSubjectId}
              onChange={handleSubjectChange}
            >
              <option value="">{selectedSemester ? 'Select subject…' : 'Select semester first…'}</option>
              {availableSubjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div id="statusMsg" style={{ color: 'var(--text-muted)', fontSize: 13, padding: '4px 4px 14px' }}>
        {statusMsg}
      </div>

      {topics.length > 0 && (
        <div id="topicWrap" className="card" style={{ padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, margin: '0 0 16px', fontFamily: "var(--font-serif)", color: '#0f172a' }}>
            Check topics you have prepared:
          </h3>
          <div id="topicList" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topics.map(t => {
              const isChecked = studiedTopics.includes(t.topic);
              return (
                <label
                  key={t.topic}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    fontSize: 13,
                    padding: '10px 14px',
                    border: '1px solid rgba(15, 23, 42, 0.08)',
                    borderRadius: 12,
                    cursor: 'pointer',
                    background: isChecked ? '#eff6ff' : '#ffffff',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <input
                    type="checkbox"
                    value={t.topic}
                    checked={isChecked}
                    onChange={() => handleTopicToggle(t.topic)}
                    style={{ accentColor: '#2563eb', cursor: 'pointer', width: 16, height: 16 }}
                  />
                  <span style={{ flex: 1, fontWeight: isChecked ? 600 : 400, color: isChecked ? '#1d4ed8' : '#0f172a' }}>
                    {t.topic}
                  </span>
                  <span className="tag blue">{t.weight_pct}% exam weight</span>
                </label>
              );
            })}
          </div>
          <button
            id="predictBtn"
            className="hero-btn-dark"
            style={{ marginTop: 20 }}
            onClick={handlePredict}
            disabled={predicting}
          >
            <TrendingUp size={15} />
            {predicting ? 'Calculating weightage…' : 'Calculate Predicted Score'}
          </button>
        </div>
      )}

      {predictionResult && (
        <div ref={resultRef} id="resultWrap" className="card" style={{ padding: 28 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 52, fontWeight: 600, color: '#0f172a', lineHeight: 1 }}>
              <span id="scoreValue">{predictionResult.predicted_score}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 32 }}>/{predictionResult.total_marks}</span>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>
              Predicted Score · <strong style={{ color: '#059669' }}>{predictionResult.coverage_pct}%</strong> syllabus coverage
            </div>
          </div>

          <div id="breakdownList" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {predictionResult.breakdown && predictionResult.breakdown.map((b, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 13,
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: b.studied ? '#f0fdf4' : '#f8fafc',
                  border: b.studied ? '1px solid #bbf7d0' : '1px solid rgba(15, 23, 42, 0.05)'
                }}
              >
                <span style={{ color: b.studied ? '#166534' : 'var(--text-muted)', fontWeight: b.studied ? 600 : 400 }}>
                  {b.topic} {b.studied ? '' : '(unprepared)'}
                </span>
                <span style={{ fontWeight: 600, color: b.studied ? '#16a34a' : 'var(--text-muted)' }}>
                  {b.studied ? `+${b.marks_contribution} marks` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
