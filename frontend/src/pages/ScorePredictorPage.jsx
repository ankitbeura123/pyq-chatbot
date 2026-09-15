import React, { useState, useEffect, useRef } from 'react';

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

    setStatusMsg('Loading topics tagged from ChromaDB…');

    try {
      const res = await fetch(`/api/predict/topics/${id}/`);
      const data = await res.json();

      if (!data.topics || !data.topics.length) {
        setStatusMsg('No tagged topics for this subject yet — run the tag_units_topics command first.');
        return;
      }

      setStatusMsg(`${data.topics.length} topics found from historical papers.`);
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
      <div className="card" style={{ padding: 20, marginBottom: 18 }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", margin: '0 0 12px', fontSize: 24 }}>
          🎯 Score Predictor
        </h2>
        <p style={{ color: 'var(--text-soft)', fontSize: 12, margin: '0 0 14px' }}>
          Tick what you've actually studied. Your predicted score is weighted by how often each topic
          has historically appeared in past papers for this subject — out of 50 marks total.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 9.5, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>
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
            <label style={{ fontSize: 9.5, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>
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

      <div id="statusMsg" style={{ color: 'var(--text-soft)', fontSize: 12, padding: '0 4px 12px' }}>
        {statusMsg}
      </div>

      {topics.length > 0 && (
        <div id="topicWrap" className="card" style={{ padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, margin: '0 0 14px', fontFamily: "'Cormorant Garamond',serif", color: 'var(--gold)' }}>
            Topics you've studied
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
                    gap: 10,
                    fontSize: 12,
                    padding: '8px 10px',
                    border: '1px solid var(--glass-edge)',
                    borderRadius: 10,
                    cursor: 'pointer',
                    background: isChecked ? 'rgba(111,211,217,0.06)' : 'transparent',
                    transition: 'background 0.15s'
                  }}
                >
                  <input
                    type="checkbox"
                    value={t.topic}
                    checked={isChecked}
                    onChange={() => handleTopicToggle(t.topic)}
                    style={{ accentColor: '#6FD3D9', cursor: 'pointer' }}
                  />
                  <span style={{ flex: 1, color: isChecked ? 'var(--starlight)' : 'var(--dim)' }}>
                    {t.topic}
                  </span>
                  <span className="tag blue">{t.weight_pct}% of papers</span>
                </label>
              );
            })}
          </div>
          <button
            id="predictBtn"
            className="btn btn-primary"
            style={{ marginTop: 16 }}
            onClick={handlePredict}
            disabled={predicting}
          >
            {predicting ? 'Calculating…' : 'Predict my score'}
          </button>
        </div>
      )}

      {predictionResult && (
        <div ref={resultRef} id="resultWrap" className="card" style={{ padding: 24 }}>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 48, color: 'var(--gold)' }}>
              <span id="scoreValue">{predictionResult.predicted_score}</span>/
              <span id="scoreTotal">{predictionResult.total_marks}</span>
            </div>
            <div style={{ color: 'var(--text-soft)', fontSize: 11 }}>
              Predicted score · <span id="coveragePct">{predictionResult.coverage_pct}</span>% syllabus coverage
            </div>
          </div>

          <div id="breakdownList" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {predictionResult.breakdown && predictionResult.breakdown.map((b, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 11.5,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: b.studied ? 'rgba(111,211,217,0.08)' : 'rgba(255,255,255,0.03)'
                }}
              >
                <span style={{ color: b.studied ? 'var(--starlight)' : 'var(--text-soft)' }}>
                  {b.topic} {b.studied ? '' : '(not studied)'}
                </span>
                <span style={{ color: 'var(--gold)' }}>
                  {b.studied ? `+${b.marks_contribution}` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
