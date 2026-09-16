import React, { useEffect, useRef } from 'react';
import earthImg from '../assets/earth.png';
import moonImg from '../assets/moon.png';

export default function CosmicBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    let w = 0, h = 0;
    let stars = [];
    let shootingStars = [];

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(180, Math.floor((w * h) / 4500));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.2 + 0.3,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 1.5 + 0.5,
        hue: Math.random() < 0.18 ? '156,140,240' : (Math.random() < 0.35 ? '228,182,103' : '231,236,250')
      }));
    }

    function maybeSpawnShootingStar() {
      if (Math.random() < 0.008 && shootingStars.length < 2) {
        shootingStars.push({
          x: Math.random() * w * 0.7 + w * 0.15,
          y: Math.random() * (h * 0.3),
          vx: -(Math.random() * 2.5 + 2.5),
          vy: Math.random() * 2.5 + 2.5,
          life: 1,
          decay: 0.014
        });
      }
    }

    function draw(timestamp) {
      const sec = timestamp * 0.001;
      ctx.clearRect(0, 0, w, h);

      for (const s of stars) {
        const twinkle = 0.25 + 0.75 * Math.abs(Math.sin(s.phase + sec * s.speed));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.hue}, ${twinkle.toFixed(3)})`;
        ctx.fill();
      }

      maybeSpawnShootingStar();
      shootingStars = shootingStars.filter(s => s.life > 0);

      for (const s of shootingStars) {
        const tailX = s.x - s.vx * 12;
        const tailY = s.y - s.vy * 12;
        const grad = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
        grad.addColorStop(0, `rgba(231,236,250,${s.life})`);
        grad.addColorStop(1, 'rgba(231,236,250,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
        s.x += s.vx;
        s.y += s.vy;
        s.life -= s.decay;
      }

      animId = requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    resize();
    animId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className="cosmic-bg-container" aria-hidden="true">
      <canvas id="stars" ref={canvasRef} />
      
      {/* Realistic Earth (Bottom Left) */}
      <div className="celestial earth-container">
        <div className="earth-atmosphere" />
        <img src={earthImg} alt="Earth" className="celestial-img earth-img" />
      </div>

      {/* Realistic Moon (Top Right) */}
      <div className="celestial moon-container">
        <div className="moon-glow" />
        <img src={moonImg} alt="Moon" className="celestial-img moon-img" />
      </div>
    </div>
  );
}