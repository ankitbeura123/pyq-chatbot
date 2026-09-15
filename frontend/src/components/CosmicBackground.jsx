import React, { useEffect, useRef } from 'react';

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
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      const count = Math.floor((w * h) / 3200);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.2 + 0.3,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.015 + 0.005,
        hue: Math.random() < 0.15 ? '156,140,240' : (Math.random() < 0.3 ? '228,182,103' : '226,231,245')
      }));
    }

    function maybeSpawnShootingStar() {
      if (Math.random() < 0.006 && shootingStars.length < 2) {
        shootingStars.push({
          x: Math.random() * w * 0.6 + w * 0.2,
          y: -20,
          vx: -3.2,
          vy: 3.6,
          life: 1,
          decay: 0.012
        });
      }
    }

    function draw(t) {
      ctx.clearRect(0, 0, w, h);

      for (const s of stars) {
        const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(s.phase + t * s.speed));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.hue}, ${twinkle})`;
        ctx.fill();
      }

      maybeSpawnShootingStar();
      shootingStars = shootingStars.filter(s => s.life > 0);

      for (const s of shootingStars) {
        const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 8, s.y - s.vy * 8);
        grad.addColorStop(0, `rgba(231,236,250,${s.life})`);
        grad.addColorStop(1, 'rgba(231,236,250,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * 8, s.y - s.vy * 8);
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
    <>
      <canvas id="stars" ref={canvasRef} />
      <div className="planet p1" />
      <div className="planet p2" />
    </>
  );
}
