import React, { useState, useEffect, useRef } from "react";
import {
  FileSpreadsheet,
  Download,
  RotateCcw,
  Sparkles,
  Clock,
  Award,
  BookOpen,
  CheckCircle2,
  FileText,
  HelpCircle,
  Eye,
  Check,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Square,
  Search,
  Layers,
  TrendingUp,
  Filter
} from "lucide-react";
import CustomSelect from "../components/CustomSelect";
import MathRenderer from "../components/MathRenderer";
import "../mock.css";

const GENERATE_ENDPOINT = "/api/mock/generate/";

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
        width: 17,
        height: 17,
        accentColor: "#2563eb",
        cursor: "pointer",
        flexShrink: 0
      }}
    />
  );
}

export default function MockExamPage() {
  const [semesters, setSemesters] = useState([]);
  const [selectedSem, setSelectedSem] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [examType, setExamType] = useState("midsem");
  const [units, setUnits] = useState([]);
  const [topics, setTopics] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [collapsedUnits, setCollapsedUnits] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [activePreset, setActivePreset] = useState("midsem_default");
  const [loadingTopics, setLoadingTopics] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState(null);

  const [paperData, setPaperData] = useState(null);
  const [qpFilename, setQpFilename] = useState(null);
  const [ansFilename, setAnsFilename] = useState(null);
  const [activeTab, setActiveTab] = useState("qp"); // "qp" or "ans"

  // Fetch subjects list on mount
  useEffect(() => {
    fetch("/api/subjects/")
      .then((res) => res.json())
      .then((data) => {
        const all = data.all_subjects || [];
        const sems = data.semesters || Array.from(new Set(all.map((s) => s.semester))).filter(Boolean);
        setSemesters(sems);
        setSubjects(all);
        if (sems.length > 0 && !selectedSem) {
          const firstSem = sems[0];
          setSelectedSem(firstSem);
          const firstSubs = all.filter((s) => s.semester === firstSem);
          if (firstSubs.length > 0 && !subjectId) {
            setSubjectId(String(firstSubs[0].id));
          }
        } else if (all.length > 0 && !subjectId) {
          setSubjectId(String(all[0].id));
        }
      })
      .catch(() => {});
  }, []);

  const handleSemesterChange = (newSem) => {
    setSelectedSem(newSem);
    const subsInSem = subjects.filter((s) => s.semester === newSem);
    if (subsInSem.length > 0) {
      setSubjectId(String(subsInSem[0].id));
    } else {
      setSubjectId("");
    }
  };

  // Preset selector helper
  const applyScopePreset = (preset, unitList = units, topicList = topics) => {
    setActivePreset(preset);
    if (!unitList.length) return;

    if (preset === "full" || preset === "all") {
      const allNames = topicList.map((t) => t.name || t.topic || (typeof t === "string" ? t : ""));
      setSelectedTopics(allNames.filter(Boolean));
    } else if (preset === "midsem_default") {
      const n = unitList.length;
      const halfCount = n / 2.0;
      const midsemNames = [];
      unitList.forEach((u, i) => {
        const uTopics = u.topics || [];
        if (i + 1 <= Math.floor(halfCount)) {
          uTopics.forEach((t) => midsemNames.push(t.name || t.topic || (typeof t === "string" ? t : "")));
        } else if (i + 1 === Math.ceil(halfCount) && n % 2 !== 0) {
          const halfLen = Math.max(1, Math.ceil(uTopics.length / 2));
          uTopics.slice(0, halfLen).forEach((t) => midsemNames.push(t.name || t.topic || (typeof t === "string" ? t : "")));
        }
      });
      setSelectedTopics(midsemNames.filter(Boolean));
    } else if (preset === "high_weight") {
      const highTopics = topicList.filter((t) => (t.weight_pct || 0) >= 5);
      if (highTopics.length > 0) {
        setSelectedTopics(highTopics.map((t) => t.name || t.topic).filter(Boolean));
      } else {
        setSelectedTopics(topicList.slice(0, Math.ceil(topicList.length / 2)).map((t) => t.name || t.topic).filter(Boolean));
      }
    } else if (preset === "clear") {
      setSelectedTopics([]);
    }
  };

  // Fetch units & topics whenever subjectId changes
  useEffect(() => {
    if (!subjectId) {
      setUnits([]);
      setTopics([]);
      setSelectedTopics([]);
      return;
    }

    setLoadingTopics(true);
    fetch(`/api/predict/topics/${subjectId}/`)
      .then((res) => res.json())
      .then((data) => {
        let unitList = data.units || [];
        const topicList = data.topics || [];

        // Fallback: If no structured units, group from topics
        if (!unitList.length && topicList.length) {
          const grouped = {};
          topicList.forEach((t) => {
            const uName = t.unit || "Unit 1";
            if (!grouped[uName]) {
              grouped[uName] = {
                unit: uName,
                title: t.unit_title || "",
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

        // Extract all topics
        const allExtractedTopics = [];
        unitList.forEach((u) => {
          (u.topics || []).forEach((t) => {
            allExtractedTopics.push({
              name: t.name || t.topic || (typeof t === "string" ? t : ""),
              topic: t.name || t.topic || (typeof t === "string" ? t : ""),
              count: t.count || 0,
              weight_pct: t.weight_pct || 0,
              unit: u.unit || t.unit || "",
              unit_title: u.title || t.unit_title || ""
            });
          });
        });

        const finalTopics = topicList.length ? topicList : allExtractedTopics;
        setUnits(unitList);
        setTopics(finalTopics);

        // By default, if midsem, select first half; if endsem, select all
        applyScopePreset(examType === "midsem" ? "midsem_default" : "full", unitList, finalTopics);
      })
      .catch((err) => {
        console.error("Failed to load subject topics:", err);
      })
      .finally(() => {
        setLoadingTopics(false);
      });
  }, [subjectId]);

  // Loading animation simulation steps
  useEffect(() => {
    let timer;
    if (loading) {
      setLoadingStep(1);
      timer = setInterval(() => {
        setLoadingStep((prev) => (prev < 4 ? prev + 1 : prev));
      }, 3500);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(timer);
  }, [loading]);

  const handleExamTypeChange = (newType) => {
    setExamType(newType);
    if (newType === "midsem" && activePreset === "full") {
      applyScopePreset("midsem_default");
    } else if (newType === "endsem" && activePreset === "midsem_default") {
      applyScopePreset("full");
    }
  };

  const handleTopicToggle = (topicName) => {
    setActivePreset("custom");
    setSelectedTopics((prev) =>
      prev.includes(topicName)
        ? prev.filter((t) => t !== topicName)
        : [...prev, topicName]
    );
  };

  const handleUnitToggle = (unit) => {
    setActivePreset("custom");
    const unitTopics = unit.topics || [];
    const unitTopicNames = unitTopics.map(
      (t) => t.name || t.topic || (typeof t === "string" ? t : "")
    ).filter(Boolean);
    if (!unitTopicNames.length) return;

    const allSelected = unitTopicNames.every((name) => selectedTopics.includes(name));
    if (allSelected) {
      setSelectedTopics((prev) => prev.filter((name) => !unitTopicNames.includes(name)));
    } else {
      setSelectedTopics((prev) => {
        const next = new Set(prev);
        unitTopicNames.forEach((name) => next.add(name));
        return Array.from(next);
      });
    }
  };

  const toggleUnitCollapse = (unitName) => {
    setCollapsedUnits((prev) => ({
      ...prev,
      [unitName]: !prev[unitName]
    }));
  };

  const handleExpandAll = () => setCollapsedUnits({});
  const handleCollapseAll = () => {
    const collapsed = {};
    units.forEach((u) => {
      collapsed[u.unit] = true;
    });
    setCollapsedUnits(collapsed);
  };

  async function handleGenerate(e) {
    if (e) e.preventDefault();
    if (!subjectId) {
      setError("Please select a subject.");
      return;
    }
    if (selectedTopics.length === 0) {
      setError("Please select at least one unit or topic to generate your mock paper.");
      return;
    }

    setError(null);
    setLoading(true);
    setPaperData(null);
    setQpFilename(null);
    setAnsFilename(null);

    // Collect units that have at least one topic selected
    const selectedUnitsSet = new Set();
    units.forEach((u) => {
      const uTopicNames = (u.topics || []).map(
        (t) => t.name || t.topic || (typeof t === "string" ? t : "")
      );
      if (uTopicNames.some((tName) => selectedTopics.includes(tName))) {
        selectedUnitsSet.add(u.unit);
      }
    });

    try {
      const res = await fetch(GENERATE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_id: parseInt(subjectId, 10),
          exam_type: examType,
          selected_topics: selectedTopics,
          selected_units: Array.from(selectedUnitsSet),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate mock paper.");
      }
      setPaperData(data.paper);
      setQpFilename(data.qp_filename);
      setAnsFilename(data.ans_filename);
      setActiveTab("qp");
    } catch (err) {
      setError(err.message || "An error occurred while generating the mock paper.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setPaperData(null);
    setQpFilename(null);
    setAnsFilename(null);
    setError(null);
  }

  const selectedSubjectObj = subjects.find((s) => String(s.id) === String(subjectId));
  const activeSemester = selectedSem || (selectedSubjectObj ? selectedSubjectObj.semester : (semesters[0] || ""));
  const filteredSubjects = activeSemester
    ? subjects.filter((s) => s.semester === activeSemester)
    : subjects;

  // Filter units and topics by search query
  const filteredUnits = units.map((u) => {
    const uTopics = u.topics || [];
    if (!searchQuery.trim()) return u;

    const q = searchQuery.toLowerCase();
    const matchesUnit =
      (u.unit && u.unit.toLowerCase().includes(q)) ||
      (u.title && u.title.toLowerCase().includes(q));
    const matchingTopics = uTopics.filter((t) => {
      const name = t.name || t.topic || (typeof t === "string" ? t : "");
      return name.toLowerCase().includes(q);
    });

    if (matchesUnit) return u;
    if (matchingTopics.length > 0) {
      return { ...u, topics: matchingTopics };
    }
    return null;
  }).filter(Boolean);

  // Calculate total weight % and active units count
  let selectedWeightPct = 0;
  let activeUnitsCount = 0;
  units.forEach((u) => {
    const uTopics = u.topics || [];
    let hasSelectedInUnit = false;
    uTopics.forEach((t) => {
      const name = t.name || t.topic || (typeof t === "string" ? t : "");
      if (selectedTopics.includes(name)) {
        selectedWeightPct += (t.weight_pct || 0);
        hasSelectedInUnit = true;
      }
    });
    if (hasSelectedInUnit) activeUnitsCount++;
  });
  selectedWeightPct = Math.min(100, Math.round(selectedWeightPct * 10) / 10);

  return (
    <div className="mock-page">
      {/* 1. SETUP CARD (When no paper is generated yet) */}
      {!paperData && (
        <div className="mock-setup-card card">
          <h1 className="mock-title">
            <FileSpreadsheet size={26} color="#2563eb" />
            Generate Mock Examination Paper
          </h1>
          <p className="mock-subtitle">
            Customize units & topics to simulate a realistic KIIT examination paper.
            Questions will be dynamically focused on the most probable topics and grounded in real university PYQs.
          </p>

          <form onSubmit={handleGenerate} className="mock-form">
            {/* 1. Selection of Semester, then 2. Selection of Subject */}
            <div className="mock-selectors-row">
              <div className="mock-selector-group">
                <label className="mock-label" htmlFor="mock-semester-select">
                  Select Semester
                </label>
                <CustomSelect
                  id="mock-semester-select"
                  value={activeSemester}
                  onChange={handleSemesterChange}
                  placeholder="— Choose Semester —"
                  options={semesters.map((sem) => ({
                    value: sem,
                    label: sem.toUpperCase(),
                  }))}
                />
              </div>

              <div className="mock-selector-group">
                <label className="mock-label" htmlFor="mock-subject-select">
                  Select Subject
                </label>
                <CustomSelect
                  id="mock-subject-select"
                  value={subjectId}
                  onChange={(val) => setSubjectId(val)}
                  placeholder="— Choose Subject —"
                  options={filteredSubjects.map((s) => ({
                    value: String(s.id),
                    label: s.name,
                  }))}
                />
              </div>
            </div>

            {/* Exam Pattern Selector */}
            <div>
              <label className="mock-label">Select Examination Pattern</label>
              <div className="exam-type-grid">
                {/* Midsem Option */}
                <div
                  className={`exam-type-card ${examType === "midsem" ? "selected" : ""}`}
                  onClick={() => handleExamTypeChange("midsem")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="exam-type-header">
                    <span className="exam-type-name">Mid-Semester Pattern</span>
                    <span className="exam-badge">20 Marks</span>
                  </div>
                  <div className="exam-type-meta">
                    <span>
                      <Clock size={12} style={{ display: "inline", marginRight: 4 }} />
                      1.5 Hours
                    </span>
                    <span>
                      <Award size={12} style={{ display: "inline", marginRight: 4 }} />
                      Q.1 (5m) + Any 3 from Q.2-Q.5 (15m)
                    </span>
                  </div>
                  <p className="exam-type-desc">
                    Official 20-mark midsem structure. Generates compulsory 1m questions + 5m long questions with sub-parts.
                  </p>
                </div>

                {/* Endsem Option */}
                <div
                  className={`exam-type-card ${examType === "endsem" ? "selected" : ""}`}
                  onClick={() => handleExamTypeChange("endsem")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="exam-type-header">
                    <span className="exam-type-name">End-Semester Pattern</span>
                    <span className="exam-badge">50 Marks</span>
                  </div>
                  <div className="exam-type-meta">
                    <span>
                      <Clock size={12} style={{ display: "inline", marginRight: 4 }} />
                      3.0 Hours
                    </span>
                    <span>
                      <Award size={12} style={{ display: "inline", marginRight: 4 }} />
                      Q.1 (10m) + Any 4 from Q.2-Q.7 (40m)
                    </span>
                  </div>
                  <p className="exam-type-desc">
                    Comprehensive 50-mark endsem format. Generates 10 compulsory 1m questions + 6 long questions (10m each).
                  </p>
                </div>
              </div>
            </div>

            {/* Interactive Units & Topics Selection Section (Like Score Predictor) */}
            <div className="mock-topics-section">
              <div className="mock-scope-header">
                <div className="mock-scope-title-group">
                  <h3>
                    <Layers size={17} color="#2563eb" />
                    Select Syllabus Units & Topics
                  </h3>
                  <div className="mock-scope-stats">
                    <strong style={{ color: "#2563eb" }}>{selectedTopics.length}</strong> of {topics.length} topics selected across {activeUnitsCount} units
                    {selectedWeightPct > 0 && ` (~${selectedWeightPct}% past exam weight)`}
                  </div>
                </div>

                {/* Quick Presets & Search Toolbar */}
                <div className="mock-toolbar">
                  <div className="mock-search-wrap">
                    <Search size={13} className="mock-search-icon" />
                    <input
                      type="text"
                      placeholder="Search topics / units…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <button
                    type="button"
                    className={`mock-btn-sm ${activePreset === "midsem_default" ? "active-preset" : ""}`}
                    onClick={() => applyScopePreset("midsem_default")}
                    title="Select first half of syllabus (traditional midsem scope)"
                  >
                    <BookOpen size={12} color="#2563eb" />
                    First Half (Midsem)
                  </button>

                  <button
                    type="button"
                    className={`mock-btn-sm ${activePreset === "full" ? "active-preset" : ""}`}
                    onClick={() => applyScopePreset("full")}
                    title="Select all units and topics"
                  >
                    <CheckSquare size={12} color="#2563eb" />
                    All Units
                  </button>

                  <button
                    type="button"
                    className={`mock-btn-sm ${activePreset === "high_weight" ? "active-preset" : ""}`}
                    onClick={() => applyScopePreset("high_weight")}
                    title="Select high-frequency exam topics"
                  >
                    <TrendingUp size={12} color="#2563eb" />
                    High Probable
                  </button>

                  <button
                    type="button"
                    className="mock-btn-sm"
                    onClick={() => applyScopePreset("clear")}
                    title="Clear all selections"
                  >
                    <Square size={12} color="#64748b" />
                    Clear
                  </button>

                  <button
                    type="button"
                    className="mock-btn-sm"
                    onClick={handleExpandAll}
                    title="Expand all units"
                  >
                    <ChevronDown size={12} />
                    Expand
                  </button>

                  <button
                    type="button"
                    className="mock-btn-sm"
                    onClick={handleCollapseAll}
                    title="Collapse all units"
                  >
                    <ChevronRight size={12} />
                    Collapse
                  </button>
                </div>
              </div>

              {loadingTopics ? (
                <div style={{ padding: "20px", textAlign: "center", color: "#64748b", fontSize: "0.9rem" }}>
                  Loading units and topic analytics from syllabus & past papers…
                </div>
              ) : units.length === 0 ? (
                <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "10px", color: "#64748b", fontSize: "0.88rem" }}>
                  No syllabus units found for this subject.
                </div>
              ) : (
                <div className="mock-unit-list">
                  {filteredUnits.map((u, uIdx) => {
                    const unitTopics = u.topics || [];
                    const unitTopicNames = unitTopics.map(
                      (t) => t.name || t.topic || (typeof t === "string" ? t : "")
                    ).filter(Boolean);
                    const selectedInUnit = unitTopicNames.filter((name) => selectedTopics.includes(name));
                    const isAllSelected = unitTopicNames.length > 0 && selectedInUnit.length === unitTopicNames.length;
                    const isSomeSelected = selectedInUnit.length > 0 && !isAllSelected;
                    const isCollapsed = Boolean(collapsedUnits[u.unit]);
                    const unitWeight = u.weight_pct || 0;

                    return (
                      <div
                        key={u.unit || uIdx}
                        className={`mock-unit-card ${isCollapsed ? "collapsed" : "is-expanded"}`}
                      >
                        {/* Unit Header with Tri-state Checkbox */}
                        <div
                          className="mock-unit-header"
                          onClick={(e) => {
                            if (e.target.type !== "checkbox" && e.target.tagName !== "LABEL") {
                              toggleUnitCollapse(u.unit);
                            }
                          }}
                        >
                          <div className="mock-unit-left">
                            <div
                              style={{ display: "flex", alignItems: "center" }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <UnitCheckbox
                                id={`mock-unit-cb-${uIdx}`}
                                checked={isAllSelected}
                                indeterminate={isSomeSelected}
                                onChange={() => handleUnitToggle(u)}
                              />
                            </div>
                            <span className="mock-unit-tag">{u.unit}</span>
                            <span className="mock-unit-title">{u.title || u.label || u.unit}</span>
                          </div>

                          <div className="mock-unit-right">
                            {unitWeight > 0 && (
                              <span className="mock-weight-chip med" title="Total weight from past year papers">
                                {unitWeight}% weight
                              </span>
                            )}
                            <span
                              className={`mock-unit-counter ${
                                isAllSelected
                                  ? "all-selected"
                                  : isSomeSelected
                                  ? "some-selected"
                                  : ""
                              }`}
                            >
                              {selectedInUnit.length} / {unitTopicNames.length} selected
                            </span>
                            <div className="mock-chevron-wrap">
                              {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                            </div>
                          </div>
                        </div>

                        {/* Collapsible Topics in this Unit */}
                        {!isCollapsed && (
                          <div className="mock-topic-list">
                            {unitTopics.length === 0 ? (
                              <div style={{ color: "#94a3b8", fontSize: "0.8rem", padding: "6px 8px" }}>
                                No sub-topics listed under this unit.
                              </div>
                            ) : (
                              unitTopics.map((t, tIdx) => {
                                const topicName = t.name || t.topic || (typeof t === "string" ? t : "");
                                const isChecked = selectedTopics.includes(topicName);
                                const tWeight = t.weight_pct || 0;
                                const tCount = t.count || 0;
                                const weightClass = tWeight >= 10 ? "high" : tWeight >= 5 ? "med" : "standard";

                                return (
                                  <div
                                    key={topicName || tIdx}
                                    className={`mock-topic-item ${isChecked ? "checked" : ""}`}
                                    onClick={() => handleTopicToggle(topicName)}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {}} // Handled by container row onClick
                                      style={{
                                        accentColor: "#2563eb",
                                        cursor: "pointer",
                                        width: 15,
                                        height: 15,
                                        flexShrink: 0
                                      }}
                                    />
                                    <span className="mock-topic-name">{topicName}</span>
                                    {tWeight > 0 ? (
                                      <span className={`mock-weight-chip ${weightClass}`}>
                                        {tWeight}% weight {tCount > 0 && `(${tCount} PYQs)`}
                                      </span>
                                    ) : (
                                      <span className="mock-weight-chip standard">
                                        Syllabus topic
                                      </span>
                                    )}
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
              )}

              {/* Informative Grounding Banner */}
              <div style={{ fontSize: "0.82rem", color: "#1e40af", display: "flex", alignItems: "center", gap: 7, background: "rgba(37,99,235,0.06)", padding: "7px 12px", borderRadius: 8, marginTop: 4 }}>
                <CheckCircle2 size={15} color="#2563eb" style={{ flexShrink: 0 }} />
                <span>
                  <b>Dual Grounding Active:</b> Questions will be drawn from your selected units & topics, prioritizing the most probable, high-frequency question archetypes from real KIIT PYQs.
                </span>
              </div>
            </div>

            {error && <div className="notes-error">{error}</div>}

            {/* Generate Button */}
            <button
              type="submit"
              className="hero-btn-dark"
              style={{ marginTop: 10, alignSelf: "flex-start" }}
              disabled={loading || selectedTopics.length === 0}
            >
              <Sparkles size={16} />
              {loading ? "Synthesizing Mock Paper…" : `Generate Mock Paper (${selectedTopics.length} Topics Selected)`}
            </button>
          </form>
        </div>
      )}

      {/* 2. ANIMATED LOADING PROGRESS */}
      {loading && (
        <div className="mock-loading-card card">
          <div className="loading-spinner-ring"></div>
          <div>
            <h2 style={{ margin: "0 0 6px", fontSize: "1.25rem", color: "#0f172a" }}>
              Creating Official Mock Examination Paper
            </h2>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.95rem" }}>
              Grounding questions in syllabus units and past examination standards…
            </p>
          </div>

          <div className="loading-step-list">
            <div className={`loading-step-item ${loadingStep >= 1 ? (loadingStep > 1 ? "done" : "active") : ""}`}>
              {loadingStep > 1 ? <CheckCircle2 size={16} color="#059669" /> : <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid currentColor" }} />}
              <span>1. Extracting syllabus boundaries for {examType.toUpperCase()}…</span>
            </div>
            <div className={`loading-step-item ${loadingStep >= 2 ? (loadingStep > 2 ? "done" : "active") : ""}`}>
              {loadingStep > 2 ? <CheckCircle2 size={16} color="#059669" /> : <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid currentColor" }} />}
              <span>2. Analyzing KIIT previous year questions & marks distribution…</span>
            </div>
            <div className={`loading-step-item ${loadingStep >= 3 ? (loadingStep > 3 ? "done" : "active") : ""}`}>
              {loadingStep > 3 ? <CheckCircle2 size={16} color="#059669" /> : <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid currentColor" }} />}
              <span>3. Formulating authentic exam questions & LaTeX expressions…</span>
            </div>
            <div className={`loading-step-item ${loadingStep >= 4 ? "active" : ""}`}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid currentColor" }} />
              <span>4. Compiling Question Paper & Answer Key PDFs…</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. GENERATED RESULT & EXAM PAPER VIEW */}
      {paperData && (
        <div className="mock-result">
          {/* Header Action Bar */}
          <div className="mock-result-header">
            <div className="mock-header-info">
              <h1>{paperData.subject_name}</h1>
              <div className="mock-header-sub">
                <span><b>Exam:</b> {paperData.exam_title}</span>
                <span><b>Time:</b> {paperData.time_allowed}</span>
                <span><b>Full Marks:</b> {paperData.full_marks}</span>
                {paperData.syllabus_scope?.scope_label && (
                  <span style={{ color: "#2563eb", fontWeight: 600 }}>
                    <b>Scope:</b> {paperData.syllabus_scope.scope_label}
                  </span>
                )}
              </div>
            </div>

            <div className="mock-action-group">
              {qpFilename && (
                <a
                  className="btn-download-qp"
                  href={`/mock/download/${qpFilename}/`}
                  download
                  title="Download Question Paper PDF"
                >
                  <Download size={15} />
                  Question Paper (PDF)
                </a>
              )}
              {ansFilename && (
                <a
                  className="btn-download-ans"
                  href={`/mock/download/${ansFilename}/`}
                  download
                  title="Download Step-by-Step Solutions PDF"
                >
                  <Download size={15} />
                  Answer Key (PDF)
                </a>
              )}
              <button type="button" className="btn" onClick={handleReset} title="Create another mock test">
                <RotateCcw size={14} />
                New Exam
              </button>
            </div>
          </div>

          {/* View Switcher Tabs */}
          <div className="view-tabs-bar">
            <button
              className={`tab-btn ${activeTab === "qp" ? "active" : ""}`}
              onClick={() => setActiveTab("qp")}
            >
              <FileText size={15} />
              Question Paper
            </button>
            <button
              className={`tab-btn ${activeTab === "ans" ? "active" : ""}`}
              onClick={() => setActiveTab("ans")}
            >
              <Check size={15} color="#059669" />
              Solutions & Marking Scheme
            </button>
          </div>

          {/* Authentic Examination Paper Sheet */}
          <div className="exam-sheet">
            {/* University Header */}
            <div className="paper-univ-header">
              <h2 className="paper-univ-name">KALINGA INSTITUTE OF INDUSTRIAL TECHNOLOGY</h2>
              <div className="paper-univ-sub">Deemed to be University, Bhubaneswar - 751024, Odisha</div>
              <div className="paper-exam-title">
                {paperData.exam_title} {activeTab === "ans" ? "— SOLUTIONS & MARKING SCHEME" : ""}
              </div>
            </div>

            <div className="paper-double-divider"></div>

            {/* Meta Table */}
            <div className="paper-meta-grid">
              <div>
                <div><b>Subject:</b> {paperData.subject_name}</div>
                <div><b>Semester / Programme:</b> {paperData.semester || "B.Tech"}</div>
                {paperData.syllabus_scope?.scope_label && (
                  <div style={{ fontSize: "0.86rem", color: "#475569", marginTop: 2 }}>
                    <b>Scope:</b> {paperData.syllabus_scope.scope_label}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <div><b>Time:</b> {paperData.time_allowed}</div>
                <div><b>Full Marks:</b> {paperData.full_marks}</div>
              </div>
            </div>

            {/* Instructions Box */}
            <div className="paper-instructions-box">
              <b>Instructions:</b> {paperData.instructions}
            </div>

            {/* SECTION A: 1-MARK COMPULSORY QUESTIONS */}
            <div className="paper-section-title">
              {paperData.section_a?.title || "SECTION - A (Compulsory)"}
            </div>

            <div className="paper-sec-a-questions">
              {(paperData.section_a?.questions || []).map((q, idx) => (
                <div key={idx} className="paper-q-row">
                  <div className="paper-q-content">
                    <span className="paper-q-id">{q.id || `1(${String.fromCharCode(97 + idx)})`}.</span>
                    <MathRenderer text={q.question_text} />

                    {q.formula && (
                      <MathRenderer text={q.formula} isBlockFormula={true} />
                    )}

                    {/* Show Solution if activeTab === 'ans' */}
                    {activeTab === "ans" && q.solution && (
                      <div className="paper-sol-box">
                        <div className="sol-label">Solution:</div>
                        <ul className="sol-steps-list">
                          {(q.solution.steps || []).map((s, si) => (
                            <li key={si}>
                              <MathRenderer text={s} />
                            </li>
                          ))}
                        </ul>
                        {q.solution.final_answer && (
                          <div className="sol-final-ans">
                            <b>Answer:</b> <MathRenderer text={q.solution.final_answer} />
                          </div>
                        )}
                        {q.solution.marking_scheme && (
                          <span className="sol-rubric-badge">
                            Rubric: <MathRenderer text={q.solution.marking_scheme} />
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="paper-q-marks">[{q.marks || 1}]</div>
                </div>
              ))}
            </div>

            {/* SECTION B: LONG QUESTIONS */}
            <div className="paper-section-title" style={{ marginTop: 32 }}>
              {paperData.section_b?.title || "SECTION - B"}
            </div>
            {paperData.section_b?.instruction && (
              <div className="paper-section-note">
                <MathRenderer text={paperData.section_b.instruction} />
              </div>
            )}

            <div className="paper-sec-b-questions">
              {(paperData.section_b?.questions || []).map((lq, lidx) => (
                <div key={lidx} className="paper-long-q">
                  <div className="paper-long-q-head">
                    Q.{lq.question_number || lidx + 2}.
                  </div>

                  {(lq.sub_parts || []).map((sp, spidx) => (
                    <div key={spidx} className="paper-q-row paper-sub-part">
                      <div className="paper-q-content">
                        <span className="paper-q-id">{sp.part || `(${String.fromCharCode(97 + spidx)})`}</span>
                        <MathRenderer text={sp.question_text} />

                        {sp.formula && (
                          <MathRenderer text={sp.formula} isBlockFormula={true} />
                        )}

                        {/* Show Solution if activeTab === 'ans' */}
                        {activeTab === "ans" && sp.solution && (
                          <div className="paper-sol-box">
                            <div className="sol-label">Solution for {sp.part}:</div>
                            <ul className="sol-steps-list">
                              {(sp.solution.steps || []).map((s, si) => (
                                <li key={si}>
                                  <MathRenderer text={s} />
                                </li>
                              ))}
                            </ul>
                            {sp.solution.final_answer && (
                              <div className="sol-final-ans">
                                <b>Result / Conclusion:</b> <MathRenderer text={sp.solution.final_answer} />
                              </div>
                            )}
                            {sp.solution.marking_scheme && (
                              <span className="sol-rubric-badge">
                                Rubric: <MathRenderer text={sp.solution.marking_scheme} />
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="paper-q-marks">[{sp.marks}]</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="paper-end-notice">
              *** END OF EXAMINATION PAPER ***
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
