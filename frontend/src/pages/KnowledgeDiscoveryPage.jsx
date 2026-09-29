import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import * as d3 from 'd3';
import {
  Compass,
  Layers,
  PieChart,
  BarChart3,
  TrendingUp,
  Sparkles,
  BookOpen,
  FileText,
  CheckCircle2,
  Target,
  Lightbulb,
  Zap,
  Search,
  HelpCircle,
  MessageSquare,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  FolderOpen
} from 'lucide-react';
import CustomSelect from '../components/CustomSelect';

const PALETTE = [
  '#2563eb', // Blue
  '#7c3aed', // Purple
  '#059669', // Emerald
  '#d97706', // Amber
  '#0891b2', // Cyan
  '#db2777', // Pink
  '#4f46e5', // Indigo
  '#ea580c', // Orange
  '#10b981', // Teal
  '#8b5cf6', // Violet
  '#f59e0b', // Yellow
  '#0284c7'  // Sky
];

export default function KnowledgeDiscoveryPage() {
  const [subjectsBySemester, setSubjectsBySemester] = useState({});
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [discoveryData, setDiscoveryData] = useState(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUnitFilter, setSelectedUnitFilter] = useState('all'); // 'all' | 'Unit 1' | 'Unit 2' ...
  const [expandedUnits, setExpandedUnits] = useState({}); // { 'Unit 1': true, ... }
  const [hoveredTopic, setHoveredTopic] = useState(null);

  const topicSvgRef = useRef(null);
  const topicTooltipRef = useRef(null);

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
    setDiscoveryData(null);
    setStatusMsg('');
    setSelectedUnitFilter('all');
    setExpandedUnits({});
  };

  const handleSubjectChange = async (val) => {
    const id = typeof val === 'object' && val?.target ? val.target.value : val;
    setSelectedSubjectId(id);
    setDiscoveryData(null);
    setSelectedUnitFilter('all');
    setExpandedUnits({});

    if (!id) {
      setStatusMsg('');
      return;
    }

    setIsLoading(true);
    setStatusMsg('Analyzing historical question distributions and syllabus mapping…');

    try {
      const res = await fetch(`/api/discover/${id}/`);
      const data = await res.json();

      if (data.error || !data.total_questions) {
        setStatusMsg(data.error || 'No past year questions ingested for this subject yet.');
        setIsLoading(false);
        return;
      }

      setStatusMsg('');
      setDiscoveryData(data);

      // Auto-expand the top unit by default
      if (data.unit_map && data.unit_map.length > 0) {
        setExpandedUnits({ [data.unit_map[0].unit || data.unit_map[0].label]: true });
      }
    } catch (err) {
      setStatusMsg(`Failed to load discovery data: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUnitExpand = (unitKey) => {
    setExpandedUnits(prev => ({
      ...prev,
      [unitKey]: !prev[unitKey]
    }));
  };

  const handleUnitSelect = (unitKey) => {
    if (selectedUnitFilter === unitKey) {
      setSelectedUnitFilter('all');
    } else {
      setSelectedUnitFilter(unitKey);
      setExpandedUnits(prev => ({ ...prev, [unitKey]: true }));
    }
  };

  const availableSubjects = selectedSemester
    ? subjectsBySemester[selectedSemester] || []
    : [];

  const selectedSubjectObj = availableSubjects.find(s => String(s.id) === String(selectedSubjectId));

  // Computed intelligence insights
  const analyticsInsights = useMemo(() => {
    if (!discoveryData) return null;

    const units = discoveryData.unit_map || [];
    const topics = discoveryData.topic_map || [];
    const totalClassified = discoveryData.classified_questions || 1;

    const totalUnitVal = units.reduce((acc, u) => acc + (u.value || u.total_questions || 0), 0) || 1;
    const topUnit = units.length > 0 ? units[0] : null;
    const topUnitCount = topUnit ? (topUnit.value || topUnit.total_questions || 0) : 0;
    const topUnitPct = topUnit ? Math.round((topUnitCount / totalUnitVal) * 100) : 0;

    let accumulated = 0;
    let topTopicsCount = 0;
    for (const t of topics) {
      accumulated += (t.value || t.count || 0);
      topTopicsCount += 1;
      if (accumulated / totalClassified >= 0.6) break;
    }

    const highYieldTopics = topics.filter(t => (t.count || t.value || 0) > 0).slice(0, Math.max(3, Math.ceil(topics.length * 0.35)));

    return {
      topUnit,
      topUnitPct,
      topTopicsCount: Math.max(1, topTopicsCount),
      highYieldTopics,
      totalUnits: units.length,
      totalTopics: topics.length,
      coveragePct: Math.round(((discoveryData.classified_questions || 0) / (discoveryData.total_questions || 1)) * 100)
    };
  }, [discoveryData]);

  // Filtered topics based on search & unit filter pills
  const filteredTopics = useMemo(() => {
    if (!discoveryData || !discoveryData.topic_map) return [];
    let list = [...discoveryData.topic_map];

    // Filter by unit
    if (selectedUnitFilter !== 'all') {
      list = list.filter(t => t.unit === selectedUnitFilter || t.unit_label === selectedUnitFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t => (t.name || t.label || '').toLowerCase().includes(q));
    }

    return list;
  }, [discoveryData, selectedUnitFilter, searchQuery]);

  // Topic chart data (matches active unit filter)
  const chartTopics = useMemo(() => {
    return filteredTopics.filter(t => (t.value || t.count || 0) > 0);
  }, [filteredTopics]);

  // D3 Donut Chart rendering
  useEffect(() => {
    if (!discoveryData || !topicSvgRef.current) return;

    const topicItems = chartTopics.length > 0 ? chartTopics : (discoveryData.topic_map || []).filter(t => (t.value || t.count || 0) > 0);
    const svg = d3.select(topicSvgRef.current);
    svg.selectAll('*').remove();

    if (!topicItems.length) return;

    const width = 340;
    const height = 340;
    const radius = Math.min(width, height) / 2 - 16;
    const innerRadius = radius * 0.62;

    const g = svg
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    const pie = d3.pie()
      .value(d => d.value || d.count || 0)
      .sort(null)
      .padAngle(0.02);

    const arc = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(radius)
      .cornerRadius(4);

    const arcHover = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(radius + 8)
      .cornerRadius(6);

    const total = topicItems.reduce((s, d) => s + (d.value || d.count || 0), 0);
    const arcs = pie(topicItems);

    const tooltipEl = topicTooltipRef.current;
    const containerEl = tooltipEl ? tooltipEl.parentElement : null;

    // Slices
    const paths = g.selectAll('path')
      .data(arcs)
      .enter()
      .append('path')
      .attr('d', arc)
      .attr('fill', (d, i) => PALETTE[i % PALETTE.length])
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .style('transition', 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)')
      .attr('opacity', d => {
        if (!hoveredTopic) return 1;
        return (hoveredTopic.name || hoveredTopic.label) === (d.data.name || d.data.label) ? 1 : 0.45;
      });

    paths
      .on('mouseenter', function(event, d) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('d', arcHover)
          .style('filter', 'drop-shadow(0 4px 12px rgba(15, 23, 42, 0.15))');

        setHoveredTopic(d.data);

        if (tooltipEl && containerEl) {
          const rect = containerEl.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          const val = d.data.value || d.data.count || 0;
          const pct = total ? ((val / total) * 100).toFixed(1) : 0;
          const unitTag = d.data.unit ? `[${d.data.unit}] ` : '';

          tooltipEl.innerHTML = `
            <div class="kd-tt-head">${unitTag}${d.data.name || d.data.label}</div>
            <div class="kd-tt-value">${val} Questions (${pct}%)</div>
          `;
          tooltipEl.style.left = `${x + 14}px`;
          tooltipEl.style.top = `${y - 12}px`;
          tooltipEl.classList.add('visible');
        }
      })
      .on('mousemove', function(event, d) {
        if (tooltipEl && containerEl) {
          const rect = containerEl.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          tooltipEl.style.left = `${x + 14}px`;
          tooltipEl.style.top = `${y - 12}px`;
        }
      })
      .on('mouseleave', function() {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('d', arc)
          .style('filter', 'none');

        setHoveredTopic(null);
        if (tooltipEl) {
          tooltipEl.classList.remove('visible');
        }
      });

  }, [discoveryData, chartTopics, hoveredTopic]);

  const totalFilteredTopicCount = chartTopics.reduce((s, d) => s + (d.value || d.count || 0), 0);

  // Distinct units list for filter bar
  const unitList = discoveryData?.syllabus_units || discoveryData?.unit_map || [];

  return (
    <>
      <style>{`
        .kd-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .kd-header-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-sans);
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--accent-blue);
          background: rgba(37, 99, 235, 0.08);
          border: 1px solid rgba(37, 99, 235, 0.18);
          padding: 4px 12px;
          border-radius: var(--radius-pill);
          margin-bottom: 12px;
        }

        .kd-title {
          font-family: var(--font-serif);
          font-size: 2.2rem;
          font-weight: 600;
          color: #0f172a;
          margin: 0 0 6px;
          line-height: 1.15;
          letter-spacing: -0.02em;
        }

        .kd-sub {
          color: var(--text-muted);
          font-size: 0.95rem;
          line-height: 1.6;
          max-width: 760px;
          margin: 0;
        }

        .kd-filter-card {
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 18px;
          padding: 22px 24px;
          box-shadow: var(--shadow-sm);
          backdrop-filter: blur(16px);
        }

        .kd-filter-row {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          align-items: flex-end;
        }

        .kd-field-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
          min-width: 200px;
        }

        .kd-field-label {
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .kd-metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }

        .kd-metric-card {
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.07);
          border-radius: 16px;
          padding: 18px 20px;
          box-shadow: var(--shadow-sm);
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: transform 0.2s ease, border-color 0.2s ease;
        }

        .kd-metric-card:hover {
          transform: translateY(-2px);
          border-color: rgba(37, 99, 235, 0.25);
        }

        .kd-metric-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .kd-metric-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .kd-metric-icon.blue { background: rgba(37, 99, 235, 0.1); color: #2563eb; }
        .kd-metric-icon.green { background: rgba(5, 150, 105, 0.1); color: #059669; }
        .kd-metric-icon.purple { background: rgba(124, 58, 237, 0.1); color: #7c3aed; }
        .kd-metric-icon.amber { background: rgba(217, 119, 6, 0.1); color: #d97706; }

        .kd-metric-val {
          font-family: var(--font-serif);
          font-size: 1.85rem;
          font-weight: 600;
          color: #0f172a;
          line-height: 1;
        }

        .kd-metric-label {
          font-size: 0.78rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        .kd-main-grid {
          display: grid;
          grid-template-columns: 1fr 1.05fr;
          gap: 20px;
        }

        .kd-card {
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 18px;
          padding: 24px;
          box-shadow: var(--shadow-sm);
        }

        .kd-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          padding-bottom: 14px;
          border-bottom: 1px solid rgba(15, 23, 42, 0.06);
        }

        .kd-card-title {
          font-family: var(--font-serif);
          font-size: 1.25rem;
          font-weight: 600;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
        }

        .kd-card-sub {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-top: 3px;
        }

        /* Unit Accordion / Drilldown */
        .kd-unit-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .kd-unit-item {
          border-radius: 14px;
          background: #f8fafc;
          border: 1px solid rgba(15, 23, 42, 0.06);
          transition: all 0.2s ease;
          overflow: hidden;
        }

        .kd-unit-item:hover,
        .kd-unit-item.active {
          background: #ffffff;
          border-color: rgba(37, 99, 235, 0.3);
          box-shadow: 0 4px 14px -2px rgba(15, 23, 42, 0.08);
        }

        .kd-unit-header-btn {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 14px 16px;
          background: transparent;
          border: none;
          text-align: left;
          cursor: pointer;
        }

        .kd-unit-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          width: 100%;
        }

        .kd-unit-left {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          min-width: 0;
          flex-wrap: wrap;
        }

        .kd-unit-rank-badge {
          font-family: var(--font-mono);
          font-size: 0.72rem;
          font-weight: 700;
          color: #1d4ed8;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          padding: 2px 7px;
          border-radius: 6px;
          flex-shrink: 0;
          line-height: 1.2;
        }

        .kd-unit-name {
          font-size: 0.88rem;
          font-weight: 600;
          color: #0f172a;
          line-height: 1.3;
        }

        .kd-top-tag {
          display: inline-flex;
          align-items: center;
          font-size: 0.68rem;
          font-weight: 600;
          color: #047857;
          background: rgba(5, 150, 105, 0.1);
          border: 1px solid rgba(5, 150, 105, 0.2);
          padding: 2px 7px;
          border-radius: var(--radius-pill);
          flex-shrink: 0;
          line-height: 1.2;
        }

        .kd-unit-counts {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text-muted);
          flex-shrink: 0;
          white-space: nowrap;
        }

        .kd-unit-count-num {
          color: var(--text-main);
        }

        .kd-unit-count-dot {
          color: var(--text-dim);
        }

        .kd-unit-count-pct {
          color: var(--accent-blue);
          font-weight: 700;
        }

        .kd-unit-expand-icon {
          color: var(--text-muted);
          transition: transform 0.2s ease;
          display: flex;
          align-items: center;
        }

        .kd-unit-bar-bg {
          height: 6px;
          background: rgba(15, 23, 42, 0.06);
          border-radius: 999px;
          overflow: hidden;
          width: 100%;
        }

        .kd-unit-bar-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #2563eb 0%, #7c3aed 100%);
          transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* Syllabus Topics Sub-list under Unit */
        .kd-unit-subtopics {
          padding: 4px 16px 14px;
          border-top: 1px solid rgba(15, 23, 42, 0.05);
          display: flex;
          flex-direction: column;
          gap: 6px;
          background: rgba(255, 255, 255, 0.5);
        }

        .kd-subtopic-header {
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-dim);
          padding: 6px 2px 2px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .kd-subtopic-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 7px 10px;
          border-radius: 8px;
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.04);
          font-size: 0.8rem;
          gap: 8px;
        }

        .kd-subtopic-name {
          color: #1e293b;
          font-weight: 500;
          flex: 1;
          line-height: 1.3;
        }

        .kd-subtopic-badge {
          font-family: var(--font-mono);
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--text-muted);
          background: #f1f5f9;
          padding: 2px 6px;
          border-radius: 4px;
          flex-shrink: 0;
        }

        .kd-subtopic-badge.active {
          color: #1d4ed8;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
        }

        /* Topics & Donut */
        .kd-donut-wrap {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px 0 16px;
        }

        .kd-donut-center {
          position: absolute;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          pointer-events: none;
          max-width: 140px;
        }

        .kd-donut-center-num {
          font-family: var(--font-serif);
          font-size: 1.8rem;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.1;
        }

        .kd-donut-center-label {
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .kd-topic-tools {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 16px;
        }

        .kd-unit-filter-pills {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          align-items: center;
        }

        .kd-search-box {
          position: relative;
          width: 100%;
        }

        .kd-search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }

        .kd-search-input {
          width: 100%;
          padding: 8px 12px 8px 34px;
          border-radius: var(--radius-pill);
          border: 1px solid rgba(15, 23, 42, 0.1);
          font-family: var(--font-sans);
          font-size: 0.82rem;
          color: var(--text-main);
          background: #f8fafc;
          outline: none;
          transition: border-color 0.15s ease, background 0.15s ease;
        }

        .kd-search-input:focus {
          border-color: var(--accent-blue);
          background: #ffffff;
        }

        .kd-pill-btn {
          font-family: var(--font-sans);
          font-size: 0.76rem;
          font-weight: 600;
          padding: 5px 12px;
          border-radius: var(--radius-pill);
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: #f8fafc;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .kd-pill-btn:hover {
          color: var(--text-main);
          border-color: rgba(15, 23, 42, 0.2);
        }

        .kd-pill-btn.active {
          background: #0d1117;
          color: #ffffff;
          border-color: #0d1117;
        }

        .kd-topic-grid {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 480px;
          overflow-y: auto;
          padding-right: 4px;
        }

        .kd-topic-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-radius: 12px;
          background: #f8fafc;
          border: 1px solid rgba(15, 23, 42, 0.05);
          gap: 12px;
          transition: all 0.15s ease;
        }

        .kd-topic-row:hover {
          background: #ffffff;
          border-color: rgba(37, 99, 235, 0.2);
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
        }

        .kd-topic-left {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          min-width: 0;
        }

        .kd-topic-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .kd-topic-title {
          font-size: 0.85rem;
          font-weight: 600;
          color: #0f172a;
          line-height: 1.3;
        }

        .kd-topic-meta {
          display: flex;
          gap: 6px;
          align-items: center;
          font-size: 0.72rem;
          color: var(--text-muted);
          margin-top: 3px;
          flex-wrap: wrap;
        }

        .kd-topic-unit-tag {
          font-family: var(--font-mono);
          font-size: 0.68rem;
          font-weight: 700;
          color: #4338ca;
          background: #e0e7ff;
          padding: 1px 5px;
          border-radius: 4px;
        }

        .kd-topic-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .kd-topic-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-family: var(--font-sans);
          font-size: 0.72rem;
          font-weight: 600;
          color: #475569 !important;
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.1);
          padding: 4px 9px;
          border-radius: var(--radius-pill);
          text-decoration: none !important;
          transition: all 0.15s ease;
        }

        .kd-topic-action-btn:hover {
          color: var(--accent-blue) !important;
          border-color: rgba(37, 99, 235, 0.3);
          background: #eff6ff;
        }

        /* Action Buttons */
        .kd-btn-primary {
          font-family: var(--font-sans);
          font-size: 0.78rem;
          font-weight: 600;
          color: #ffffff !important;
          background: #0d1117;
          border: 1px solid #0d1117;
          border-radius: var(--radius-pill);
          padding: 7px 15px;
          text-decoration: none !important;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 2px 6px rgba(13, 17, 23, 0.18);
          transition: all 0.2s ease;
          cursor: pointer;
        }

        .kd-btn-primary:hover {
          background: #1f2937;
          color: #ffffff !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(13, 17, 23, 0.25);
        }

        .kd-btn-secondary {
          font-family: var(--font-sans);
          font-size: 0.78rem;
          font-weight: 600;
          color: #0f172a !important;
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.18);
          border-radius: var(--radius-pill);
          padding: 7px 15px;
          text-decoration: none !important;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          transition: all 0.2s ease;
          cursor: pointer;
        }

        .kd-btn-secondary:hover {
          background: #f8fafc;
          border-color: rgba(15, 23, 42, 0.35);
          color: #0f172a !important;
          transform: translateY(-1px);
          box-shadow: 0 3px 8px rgba(15, 23, 42, 0.08);
        }

        /* Tooltip */
        .kd-tooltip {
          position: absolute;
          pointer-events: none;
          background: #0d1117;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 10px;
          padding: 8px 12px;
          font-family: var(--font-sans);
          font-size: 12px;
          color: #ffffff;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
          opacity: 0;
          transition: opacity 0.12s ease;
          z-index: 20;
          white-space: nowrap;
        }

        .kd-tooltip.visible { opacity: 1; }
        .kd-tt-head { font-weight: 600; margin-bottom: 2px; }
        .kd-tt-value { color: #93c5fd; font-size: 11px; }

        /* Insights Card */
        .kd-insights-card {
          background: #f8fafc;
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 18px;
          padding: 24px;
        }

        .kd-insights-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .kd-insight-item {
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.06);
          border-radius: 14px;
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .kd-insight-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .kd-insight-desc {
          font-size: 0.82rem;
          color: var(--text-muted);
          line-height: 1.5;
        }

        /* Empty State */
        .kd-empty-state {
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 20px;
          padding: 48px 24px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          box-shadow: var(--shadow-sm);
        }

        .kd-empty-icon-circle {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          background: rgba(37, 99, 235, 0.08);
          color: var(--accent-blue);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }

        .kd-empty-title {
          font-family: var(--font-serif);
          font-size: 1.6rem;
          font-weight: 600;
          color: #0f172a;
          margin: 0 0 8px;
        }

        .kd-empty-desc {
          color: var(--text-muted);
          font-size: 0.92rem;
          max-width: 540px;
          line-height: 1.6;
          margin: 0 0 32px;
        }

        .kd-empty-features {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          max-width: 820px;
          width: 100%;
          text-align: left;
        }

        .kd-empty-feature-card {
          background: #f8fafc;
          border: 1px solid rgba(15, 23, 42, 0.06);
          border-radius: 14px;
          padding: 18px;
        }

        .kd-empty-feature-title {
          font-size: 0.88rem;
          font-weight: 700;
          color: #0f172a;
          margin: 10px 0 4px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .kd-empty-feature-desc {
          font-size: 0.8rem;
          color: var(--text-muted);
          line-height: 1.5;
        }

        @media (max-width: 960px) {
          .kd-metrics-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .kd-main-grid {
            grid-template-columns: 1fr;
          }
          .kd-insights-grid {
            grid-template-columns: 1fr;
          }
          .kd-empty-features {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .kd-metrics-grid {
            grid-template-columns: 1fr;
          }
          .kd-filter-card {
            padding: 16px;
          }
        }
      `}</style>

      <div className="kd-container">
        {/* Header Section */}
        <div>
          <div className="kd-header-tag">
            <Sparkles size={13} />
            Syllabus Intelligence & Pattern Analytics
          </div>
          <h1 className="kd-title">Knowledge Discovery</h1>
          <p className="kd-sub">
            Explore verified question distributions across syllabus units and historical recurrence patterns to optimize your exam strategy.
          </p>
        </div>

        {/* Filter Selection Card */}
        <div className="kd-filter-card">
          <div className="kd-filter-row">
            <div className="kd-field-group">
              <label className="kd-field-label">
                <BookOpen size={13} />
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

            <div className="kd-field-group" style={{ flex: 1.4 }}>
              <label className="kd-field-label">
                <Layers size={13} />
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
            <div style={{ marginTop: 14, fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {isLoading && <div className="send" style={{ width: 14, height: 14, border: '2px solid var(--accent-blue)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
              <span>{statusMsg}</span>
            </div>
          )}
        </div>

        {/* Loaded State */}
        {discoveryData && (
          <>
            {/* Top Metric Summary Cards */}
            <div className="kd-metrics-grid">
              <div className="kd-metric-card">
                <div className="kd-metric-top">
                  <span className="kd-metric-label">Total Questions</span>
                  <div className="kd-metric-icon blue">
                    <FileText size={18} />
                  </div>
                </div>
                <div className="kd-metric-val">{discoveryData.total_questions}</div>
                <div className="kd-metric-label">Historical questions indexed</div>
              </div>

              <div className="kd-metric-card">
                <div className="kd-metric-top">
                  <span className="kd-metric-label">Syllabus Tagged</span>
                  <div className="kd-metric-icon green">
                    <CheckCircle2 size={18} />
                  </div>
                </div>
                <div className="kd-metric-val">
                  {discoveryData.classified_questions}
                  <span style={{ fontSize: '0.9rem', color: '#059669', marginLeft: 8, fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
                    ({analyticsInsights?.coveragePct}%)
                  </span>
                </div>
                <div className="kd-metric-label">Mapped to syllabus units</div>
              </div>

              <div className="kd-metric-card">
                <div className="kd-metric-top">
                  <span className="kd-metric-label">Syllabus Units</span>
                  <div className="kd-metric-icon purple">
                    <Layers size={18} />
                  </div>
                </div>
                <div className="kd-metric-val">{unitList.length}</div>
                <div className="kd-metric-label">Core modular sections</div>
              </div>

              <div className="kd-metric-card">
                <div className="kd-metric-top">
                  <span className="kd-metric-label">Topics Discovered</span>
                  <div className="kd-metric-icon amber">
                    <TrendingUp size={18} />
                  </div>
                </div>
                <div className="kd-metric-val">{discoveryData.topic_map?.length || 0}</div>
                <div className="kd-metric-label">Syllabus topics tracked</div>
              </div>
            </div>

            {/* Main Visualizations Grid */}
            <div className="kd-main-grid">
              {/* Unit Question Weightage & Syllabus Topics Drilldown */}
              <div className="kd-card">
                <div className="kd-card-header">
                  <div>
                    <h3 className="kd-card-title">
                      <Layers size={18} color="#2563eb" />
                      Unit Question Weightage
                    </h3>
                    <div className="kd-card-sub">
                      Click any unit to expand syllabus topics and question counts
                    </div>
                  </div>
                  <span className="tag blue">
                    {unitList.length} Units
                  </span>
                </div>

                <div className="kd-unit-list">
                  {unitList.map((unit, index) => {
                    const totalUnitQs = unitList.reduce((s, u) => s + (u.value || u.total_questions || 0), 0) || 1;
                    const uCount = unit.value || unit.total_questions || 0;
                    const pct = Math.round((uCount / totalUnitQs) * 100);
                    const isTop = index === 0;
                    const unitKey = unit.unit || unit.label;
                    const isExpanded = !!expandedUnits[unitKey];
                    const isSelected = selectedUnitFilter === unitKey;
                    const subtopics = unit.topics || [];

                    return (
                      <div
                        key={unitKey}
                        className={`kd-unit-item ${isSelected ? 'active' : ''}`}
                      >
                        <button
                          type="button"
                          className="kd-unit-header-btn"
                          onClick={() => {
                            toggleUnitExpand(unitKey);
                            handleUnitSelect(unitKey);
                          }}
                        >
                          <div className="kd-unit-top">
                            <div className="kd-unit-left">
                              <span className="kd-unit-rank-badge">#{index + 1}</span>
                              <span className="kd-unit-name" title={unit.title ? `${unit.unit}: ${unit.title}` : unit.label}>
                                {unit.unit ? `${unit.unit}${unit.title ? `: ${unit.title}` : ''}` : unit.label}
                              </span>
                              {isTop && (
                                <span className="kd-top-tag">
                                  Top Weight
                                </span>
                              )}
                            </div>
                            <div className="kd-unit-counts">
                              <span className="kd-unit-count-num">{uCount} Qs</span>
                              <span className="kd-unit-count-dot">·</span>
                              <span className="kd-unit-count-pct">{pct}%</span>
                              <span className="kd-unit-expand-icon">
                                {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                              </span>
                            </div>
                          </div>

                          <div className="kd-unit-bar-bg">
                            <div
                              className="kd-unit-bar-fill"
                              style={{
                                width: `${pct}%`,
                                background: isTop
                                  ? 'linear-gradient(90deg, #2563eb 0%, #7c3aed 100%)'
                                  : 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)'
                              }}
                            />
                          </div>
                        </button>

                        {/* Expandable Syllabus Topics under this Unit */}
                        {isExpanded && (
                          <div className="kd-unit-subtopics">
                            <div className="kd-subtopic-header">
                              <span>Syllabus Topics ({subtopics.length})</span>
                              <span>Past Exam Questions</span>
                            </div>
                            {subtopics.map(t => {
                              const tCount = t.count || t.value || 0;
                              return (
                                <div key={t.name || t.label} className="kd-subtopic-row">
                                  <span className="kd-subtopic-name">{t.name || t.label}</span>
                                  <span className={`kd-subtopic-badge ${tCount > 0 ? 'active' : ''}`}>
                                    {tCount} {tCount === 1 ? 'Q' : 'Qs'}
                                  </span>
                                </div>
                              );
                            })}
                            {subtopics.length === 0 && (
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '6px 0' }}>
                                No specific subtopics listed in syllabus cache.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Topic Distribution & Intelligence Matrix */}
              <div className="kd-card" style={{ position: 'relative' }}>
                <div className="kd-card-header">
                  <div>
                    <h3 className="kd-card-title">
                      <PieChart size={18} color="#7c3aed" />
                      Topic Recurrence Distribution
                    </h3>
                    <div className="kd-card-sub">
                      {selectedUnitFilter === 'all'
                        ? 'All syllabus topics ranked by historical question frequency'
                        : `Showing topics specifically under ${selectedUnitFilter}`}
                    </div>
                  </div>
                  <span className="tag purple">
                    {filteredTopics.length} Topics
                  </span>
                </div>

                {/* Donut Chart Visualization */}
                <div className="kd-donut-wrap">
                  <svg ref={topicSvgRef} width="340" height="340" viewBox="0 0 340 340" />
                  <div className="kd-donut-center">
                    <div className="kd-donut-center-num">
                      {hoveredTopic ? (hoveredTopic.value || hoveredTopic.count || 0) : totalFilteredTopicCount}
                    </div>
                    <div className="kd-donut-center-label">
                      {hoveredTopic ? (hoveredTopic.name || hoveredTopic.label) : (selectedUnitFilter === 'all' ? 'Tagged Questions' : `${selectedUnitFilter} Qs`)}
                    </div>
                  </div>
                  <div ref={topicTooltipRef} className="kd-tooltip" />
                </div>

                {/* Topic Search & Unit Filters */}
                <div className="kd-topic-tools">
                  <div className="kd-unit-filter-pills">
                    <button
                      type="button"
                      className={`kd-pill-btn ${selectedUnitFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setSelectedUnitFilter('all')}
                    >
                      All Units
                    </button>
                    {unitList.map(u => {
                      const uKey = u.unit || u.label;
                      return (
                        <button
                          key={uKey}
                          type="button"
                          className={`kd-pill-btn ${selectedUnitFilter === uKey ? 'active' : ''}`}
                          onClick={() => setSelectedUnitFilter(uKey)}
                        >
                          {u.unit || uKey}
                        </button>
                      );
                    })}
                  </div>

                  <div className="kd-search-box">
                    <Search size={14} className="kd-search-icon" />
                    <input
                      type="text"
                      className="kd-search-input"
                      placeholder="Search syllabus topics…"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                {/* Topic List */}
                <div className="kd-topic-grid">
                  {filteredTopics.map((item, idx) => {
                    const color = PALETTE[idx % PALETTE.length];
                    const tCount = item.count || item.value || 0;
                    const totalQ = discoveryData.classified_questions || 1;
                    const pct = Math.round((tCount / totalQ) * 100);
                    const isHighYield = tCount > 0 && idx < 4;

                    return (
                      <div key={item.name || item.label} className="kd-topic-row">
                        <div className="kd-topic-left">
                          <div className="kd-topic-dot" style={{ background: color }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="kd-topic-title" title={item.name || item.label}>
                              {item.name || item.label}
                            </div>
                            <div className="kd-topic-meta">
                              {item.unit && (
                                <span className="kd-topic-unit-tag">
                                  {item.unit}
                                </span>
                              )}
                              <span>{tCount} question{tCount === 1 ? '' : 's'}</span>
                              <span>·</span>
                              <span>{pct}% syllabus weight</span>
                              {isHighYield && (
                                <>
                                  <span>·</span>
                                  <span style={{ color: '#d97706', fontWeight: 600 }}>Frequent</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="kd-topic-actions">
                          <Link
                            to={`/chat?q=${encodeURIComponent(`Explain key PYQ questions and exam points for ${item.name || item.label} in ${selectedSubjectObj?.name || 'this subject'}`)}`}
                            className="kd-topic-action-btn"
                            title="Ask AI assistant about this topic"
                          >
                            <MessageSquare size={12} />
                            Ask
                          </Link>
                          <Link
                            to="/quiz"
                            className="kd-topic-action-btn"
                            title="Generate quiz on this topic"
                          >
                            <HelpCircle size={12} />
                            Quiz
                          </Link>
                        </div>
                      </div>
                    );
                  })}

                  {filteredTopics.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No topics matched your search filter.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Strategic Exam Insights Card */}
            {analyticsInsights && (
              <div className="kd-insights-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                    <Lightbulb size={18} color="#d97706" />
                    Strategic Exam Insights
                  </h3>
                  <span className="tag amber">AI Exam Guidance</span>
                </div>

                <div className="kd-insights-grid">
                  <div className="kd-insight-item">
                    <div className="kd-insight-title">
                      <Target size={15} color="#2563eb" />
                      Primary High-Yield Unit
                    </div>
                    <div className="kd-insight-desc">
                      <strong>{analyticsInsights.topUnit?.unit ? `${analyticsInsights.topUnit.unit}${analyticsInsights.topUnit.title ? `: ${analyticsInsights.topUnit.title}` : ''}` : (analyticsInsights.topUnit?.label || 'Top Unit')}</strong> represents{' '}
                      <strong>{analyticsInsights.topUnitPct}%</strong> of all historical exam questions. Prioritizing this module secures the largest portion of core marks.
                    </div>
                  </div>

                  <div className="kd-insight-item">
                    <div className="kd-insight-title">
                      <TrendingUp size={15} color="#059669" />
                      Concentrated Topic Focus
                    </div>
                    <div className="kd-insight-desc">
                      The top <strong>{analyticsInsights.topTopicsCount} topics</strong> cover over{' '}
                      <strong>60%</strong> of repeated question patterns. Revising these recurrent concepts maximizes study ROI.
                    </div>
                  </div>

                  <div className="kd-insight-item">
                    <div className="kd-insight-title">
                      <Zap size={15} color="#7c3aed" />
                      Next Action Step
                    </div>
                    <div className="kd-insight-desc" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <span>Test your readiness across these discovered topics using score simulation or mock papers:</span>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
                        <Link to="/predict" className="kd-btn-primary">
                          <TrendingUp size={13} />
                          Predict Score
                        </Link>
                        <Link to="/mock" className="kd-btn-secondary">
                          <FileSpreadsheet size={13} />
                          Generate Mock
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty / Initial State */}
        {!discoveryData && !isLoading && (
          <div className="kd-empty-state">
            <div className="kd-empty-icon-circle">
              <Compass size={28} />
            </div>
            <h2 className="kd-empty-title">Unlock Syllabus Intelligence</h2>
            <p className="kd-empty-desc">
              Select your semester and subject above to discover question weightage, historical recurrence trends, and high-yield topics extracted from verified past exam papers.
            </p>

            <div className="kd-empty-features">
              <div className="kd-empty-feature-card">
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Layers size={16} />
                </div>
                <div className="kd-empty-feature-title">
                  Unit Weightage Breakdown
                </div>
                <div className="kd-empty-feature-desc">
                  Identify which syllabus modules carry the highest frequency of questions across midsem and endsem exams.
                </div>
              </div>

              <div className="kd-empty-feature-card">
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={16} />
                </div>
                <div className="kd-empty-feature-title">
                  Recurrent Topic Ranking
                </div>
                <div className="kd-empty-feature-desc">
                  Pinpoint recurring questions and core concepts repeatedly tested over the years.
                </div>
              </div>

              <div className="kd-empty-feature-card">
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(5, 150, 105, 0.1)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Target size={16} />
                </div>
                <div className="kd-empty-feature-title">
                  Strategic Prep Actions
                </div>
                <div className="kd-empty-feature-desc">
                  Seamlessly launch into AI explanations, targeted quizzes, or score predictions for any discovered topic.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
