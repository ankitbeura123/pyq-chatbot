import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Compass, Orbit, PieChart } from 'lucide-react';
import CustomSelect from '../components/CustomSelect';

const PALETTE = [
  '#2563eb', '#7c3aed', '#d97706', '#db2777',
  '#0284c7', '#8b5cf6', '#ea580c', '#059669',
  '#ec4899', '#3b82f6', '#f43f5e', '#10b981'
];

export default function KnowledgeDiscoveryPage() {
  const [subjectsBySemester, setSubjectsBySemester] = useState({});
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [discoveryData, setDiscoveryData] = useState(null);

  const unitSvgRef = useRef(null);
  const topicSvgRef = useRef(null);
  const unitTooltipRef = useRef(null);
  const topicTooltipRef = useRef(null);
  const dynamicStylesRef = useRef(null);

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
  };

  const handleSubjectChange = async (val) => {
    const id = typeof val === 'object' && val?.target ? val.target.value : val;
    setSelectedSubjectId(id);
    setDiscoveryData(null);

    if (!id) {
      setStatusMsg('');
      return;
    }

    setStatusMsg('Loading real data from ChromaDB…');

    try {
      const res = await fetch(`/api/discover/${id}/`);
      const data = await res.json();

      if (data.error || !data.total_questions) {
        setStatusMsg(data.error || 'No data available for this subject yet.');
        return;
      }

      setStatusMsg(`${data.classified_questions} of ${data.total_questions} questions classified`);
      setDiscoveryData(data);
    } catch (err) {
      setStatusMsg(`Failed to load discovery data: ${err.message}`);
    }
  };

  const showTooltip = (tooltipEl, containerEl, evt, title, count, extra) => {
    if (!tooltipEl || !containerEl) return;
    const rect = containerEl.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;
    tooltipEl.innerHTML = `
      <span class="tt-title">${title}</span>
      <span class="tt-count">${count} question${count === 1 ? '' : 's'}</span>
      ${extra ? `<br><span style="color:var(--text-muted);">${extra}</span>` : ''}
    `;
    tooltipEl.style.left = `${x + 16}px`;
    tooltipEl.style.top = `${y - 10}px`;
    tooltipEl.classList.add('visible');
  };

  const hideTooltip = (tooltipEl) => {
    if (tooltipEl) {
      tooltipEl.classList.remove('visible');
    }
  };

  // Render D3 Orbital Unit Map & Topic Pie Chart whenever discoveryData changes
  useEffect(() => {
    if (!discoveryData) return;

    // 1. Render Orbital Map
    const unitSvg = d3.select(unitSvgRef.current);
    unitSvg.selectAll('*').remove();
    const unitTooltipEl = unitTooltipRef.current;
    const unitContainerEl = unitTooltipEl ? unitTooltipEl.parentElement : null;

    const CENTER = 280;
    const MAX_ORBIT_R = 250;
    const MIN_ORBIT_R = 65;
    const items = discoveryData.unit_map || [];

    if (!items.length) {
      unitSvg.append('text')
        .attr('x', CENTER).attr('y', CENTER).attr('text-anchor', 'middle')
        .attr('fill', '#8892b0').attr('font-size', 12).text('No data');
    } else {
      const sorted = [...items].sort((a, b) => b.value - a.value);
      const n = sorted.length;
      const maxVal = sorted[0].value;
      const minVal = sorted[n - 1].value;
      const orbitStep = (MAX_ORBIT_R - MIN_ORBIT_R) / Math.max(n - 1, 1);
      const planetScale = d3.scaleSqrt().domain([minVal, maxVal]).range([10, 28]);

      const defs = unitSvg.append('defs');

      const sunGrad = defs.append('radialGradient').attr('id', 'sunGrad');
      sunGrad.append('stop').attr('offset', '0%').attr('stop-color', '#FFF6DE');
      sunGrad.append('stop').attr('offset', '55%').attr('stop-color', '#F0C374');
      sunGrad.append('stop').attr('offset', '100%').attr('stop-color', '#B3833F');

      sorted.forEach((item, i) => {
        const base = d3.color(PALETTE[i % PALETTE.length]);
        const grad = defs.append('radialGradient')
          .attr('id', `planetGrad${i}`)
          .attr('cx', '35%')
          .attr('cy', '30%');
        grad.append('stop').attr('offset', '0%').attr('stop-color', base.brighter(1.4));
        grad.append('stop').attr('offset', '60%').attr('stop-color', base);
        grad.append('stop').attr('offset', '100%').attr('stop-color', base.darker(1.2));
      });

      // Starfield dots
      const rng = d3.randomUniform(0, 560);
      for (let s = 0; s < 40; s++) {
        unitSvg.append('circle')
          .attr('cx', rng()).attr('cy', rng()).attr('r', Math.random() * 1.2)
          .attr('fill', 'rgba(15, 23, 42, 0.15)');
      }

      // Orbit rings
      sorted.forEach((item, i) => {
        const r = MIN_ORBIT_R + i * orbitStep;
        unitSvg.append('circle')
          .attr('class', 'orbit-ring')
          .attr('cx', CENTER).attr('cy', CENTER).attr('r', r);
      });

      // Sun with corona
      unitSvg.append('circle')
        .attr('cx', CENTER).attr('cy', CENTER).attr('r', 34)
        .attr('fill', 'url(#sunGrad)').attr('opacity', 0.25);
      unitSvg.append('circle')
        .attr('class', 'sun-glow')
        .attr('cx', CENTER).attr('cy', CENTER).attr('r', 22)
        .attr('fill', 'url(#sunGrad)');

      // Keyframes
      let keyframeCSS = '';

      sorted.forEach((item, i) => {
        const r = MIN_ORBIT_R + i * orbitStep;
        const pr = planetScale(item.value);
        const startAngle = Math.random() * 360;
        const duration = (10 + Math.random() * 22).toFixed(1);
        const direction = Math.random() < 0.5 ? 'normal' : 'reverse';
        const animName = `orbit_react_${i}`;

        keyframeCSS += `
          @keyframes ${animName} {
            from { transform: rotate(0deg); }
            to { transform: rotate(${direction === 'normal' ? 360 : -360}deg); }
          }
        `;

        const orbitG = unitSvg.append('g')
          .attr('class', 'orbit-group')
          .attr('id', `${animName}_group`)
          .attr('transform', `rotate(${startAngle} ${CENTER} ${CENTER})`)
          .style('animation', `${animName} ${duration}s linear infinite`);

        const planetX = CENTER + r;
        const planetY = CENTER;

        const hasRing = (i % 3 === 1);
        if (hasRing) {
          orbitG.append('ellipse')
            .attr('cx', planetX).attr('cy', planetY)
            .attr('rx', pr * 1.9).attr('ry', pr * 0.55)
            .attr('fill', 'none')
            .attr('stroke', PALETTE[i % PALETTE.length])
            .attr('stroke-opacity', 0.55)
            .attr('stroke-width', 2)
            .attr('transform', `rotate(-18 ${planetX} ${planetY})`);
        }

        const planet = orbitG.append('circle')
          .attr('class', 'planet-body')
          .attr('cx', planetX).attr('cy', planetY)
          .attr('r', pr)
          .attr('fill', `url(#planetGrad${i})`)
          .attr('stroke', PALETTE[i % PALETTE.length])
          .attr('stroke-opacity', 0.4)
          .attr('stroke-width', 1);

        planet
          .on('mouseenter', function(event) {
            const groupEl = document.getElementById(`${animName}_group`);
            if (groupEl) groupEl.style.animationPlayState = 'paused';
            showTooltip(unitTooltipEl, unitContainerEl, event, item.label, item.value, `Orbit rank #${i + 1} of ${n}`);
          })
          .on('mousemove', function(event) {
            showTooltip(unitTooltipEl, unitContainerEl, event, item.label, item.value, `Orbit rank #${i + 1} of ${n}`);
          })
          .on('mouseleave', function() {
            const groupEl = document.getElementById(`${animName}_group`);
            if (groupEl) groupEl.style.animationPlayState = 'running';
            hideTooltip(unitTooltipEl);
          });
      });

      if (dynamicStylesRef.current) {
        dynamicStylesRef.current.textContent = keyframeCSS;
      }
    }

    // 2. Render Topic Pie Chart
    const topicSvg = d3.select(topicSvgRef.current);
    topicSvg.selectAll('*').remove();
    const topicTooltipEl = topicTooltipRef.current;
    const topicContainerEl = topicTooltipEl ? topicTooltipEl.parentElement : null;

    const WIDTH = 440, HEIGHT = 440, RADIUS = 175;
    const topicItems = discoveryData.topic_map || [];

    if (!topicItems.length) {
      topicSvg.append('text')
        .attr('x', WIDTH / 2).attr('y', HEIGHT / 2).attr('text-anchor', 'middle')
        .attr('fill', '#8892b0').attr('font-size', 12).text('No data');
    } else {
      const total = topicItems.reduce((s, d) => s + d.value, 0);
      const g = topicSvg.append('g').attr('transform', `translate(${WIDTH / 2},${HEIGHT / 2})`);

      const defs = topicSvg.append('defs');
      topicItems.forEach((item, i) => {
        const base = d3.color(PALETTE[i % PALETTE.length]);
        const grad = defs.append('radialGradient').attr('id', `sliceGrad${i}`);
        grad.append('stop').attr('offset', '0%').attr('stop-color', base.brighter(0.8));
        grad.append('stop').attr('offset', '100%').attr('stop-color', base);
      });

      const pie = d3.pie().value(d => d.value).sort(null);
      const arc = d3.arc().innerRadius(RADIUS * 0.42).outerRadius(RADIUS);
      const arcHover = d3.arc().innerRadius(RADIUS * 0.42).outerRadius(RADIUS + 10);

      const arcs = pie(topicItems);

      g.selectAll('path')
        .data(arcs)
        .enter()
        .append('path')
        .attr('d', arc)
        .attr('fill', (d, i) => `url(#sliceGrad${i})`)
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .style('transition', 'filter 0.15s')
        .on('mouseenter', function(event, d) {
          d3.select(this).transition().duration(150).attr('d', arcHover);
          d3.select(this).style('filter', 'brightness(1.15)');
          const pct = ((d.data.value / total) * 100).toFixed(1);
          showTooltip(topicTooltipEl, topicContainerEl, event, d.data.label, d.data.value, `${pct}% of tagged questions`);
        })
        .on('mousemove', function(event, d) {
          const pct = ((d.data.value / total) * 100).toFixed(1);
          showTooltip(topicTooltipEl, topicContainerEl, event, d.data.label, d.data.value, `${pct}% of tagged questions`);
        })
        .on('mouseleave', function() {
          d3.select(this).transition().duration(150).attr('d', arc);
          d3.select(this).style('filter', 'brightness(1)');
          hideTooltip(topicTooltipEl);
        });

      // Center label
      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '-4')
        .attr('font-family', "var(--font-serif)")
        .attr('font-size', 26)
        .attr('font-weight', '600')
        .attr('fill', '#0f172a')
        .text(total);

      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '18')
        .attr('font-family', "var(--font-sans)")
        .attr('font-size', 10)
        .attr('font-weight', '700')
        .attr('letter-spacing', '0.05em')
        .attr('fill', 'var(--text-muted)')
        .text("TOTAL QUESTIONS");
    }
  }, [discoveryData]);

  const availableSubjects = selectedSemester
    ? subjectsBySemester[selectedSemester] || []
    : [];

  return (
    <>
      <style ref={dynamicStylesRef} />
      <style>{`
        .visual-card { position: relative; display:flex; justify-content:center; padding: 10px; }

        .orbit-ring { fill:none; stroke:rgba(15, 23, 42, 0.08); stroke-width: 1; }
        .orbit-group { transform-origin: center; }
        .planet-body { cursor: pointer; transition: filter 0.2s; }
        .planet-body:hover { filter: brightness(1.2); }
        .sun-glow { filter: drop-shadow(0 0 14px rgba(245, 158, 11, 0.7)) drop-shadow(0 0 28px rgba(245, 158, 11, 0.3)); }

        .hover-tooltip {
          position: absolute;
          pointer-events: none;
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.1);
          border-radius: 10px;
          padding: 8px 12px;
          font-family: var(--font-sans);
          font-size: 12px;
          color: #0f172a;
          box-shadow: 0 10px 25px rgba(15, 23, 42, 0.1);
          opacity: 0;
          transition: opacity 0.15s;
          z-index: 10;
          white-space: nowrap;
        }
        .hover-tooltip.visible { opacity: 1; }
        .hover-tooltip .tt-title { color: #0f172a; font-weight: 700; margin-bottom: 2px; display:block; }
        .hover-tooltip .tt-count { color: var(--accent-blue); font-weight: 600; }

        @media (prefers-reduced-motion: reduce) { .orbit-group { animation: none !important; } }
      `}</style>

      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontFamily: "var(--font-serif)", margin: '0 0 10px', fontSize: 26, display: 'flex', alignItems: 'center', gap: 10, color: '#0f172a' }}>
          <Compass size={22} color="#2563eb" />
          Knowledge Discovery
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 16px' }}>
          Real patterns mined from past year questions. Closer & larger node = higher question frequency. Hover over nodes to inspect details.
        </p>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
            <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 260 }}>
            <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
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
      </div>

      <div id="statusMsg" style={{ color: 'var(--text-muted)', fontSize: 13, padding: '4px 4px 14px' }}>
        {statusMsg}
      </div>

      {discoveryData && (
        <div id="chartsWrap">
          <div className="card" style={{ padding: 24, marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, margin: '0 0 16px', fontFamily: "var(--font-serif)", color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Orbit size={18} color="#7c3aed" />
              Unit Map — Orbital Frequency
            </h3>
            <div className="visual-card">
              <svg ref={unitSvgRef} id="unitSvg" width="100%" viewBox="0 0 560 560" style={{ maxWidth: 560 }} />
              <div ref={unitTooltipRef} className="hover-tooltip" id="unitTooltip" />
            </div>
          </div>

          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, margin: '0 0 16px', fontFamily: "var(--font-serif)", color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <PieChart size={18} color="#059669" />
              Topic Distribution
            </h3>
            <div className="visual-card">
              <svg ref={topicSvgRef} id="topicSvg" width="100%" viewBox="0 0 440 440" style={{ maxWidth: 440 }} />
              <div ref={topicTooltipRef} className="hover-tooltip" id="topicTooltip" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
