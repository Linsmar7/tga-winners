import React, { useEffect, useRef } from 'react';

const COLORS = ['#fbbf24', '#f59e0b', '#f43f5e', '#34d399', '#60a5fa', '#fef08a', '#ffffff'];

/**
 * Explosão leve de confetes em Canvas 2D sempre que `burstId` incrementar (> 0).
 */
export default function ConfettiCanvas({ burstId = 0 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!burstId) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = (canvas.width = window.innerWidth);
    const height = (canvas.height = window.innerHeight);

    const particles = Array.from({ length: 110 }, () => {
      const angle = (Math.random() * Math.PI * 2) / 3 - Math.PI / 2 - Math.PI / 6;
      const speed = 5 + Math.random() * 11;
      return {
        x: width * (0.2 + Math.random() * 0.6),
        y: height * 0.55,
        vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 6,
        vy: -Math.abs(Math.sin(angle) * speed) - 4 - Math.random() * 6,
        size: 5 + Math.random() * 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.22,
        life: 1,
      };
    });

    let rafId = null;
    const startTime = performance.now();

    const frame = (now) => {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, width, height);

      let alive = false;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.28; // gravidade
        p.vx *= 0.99;
        p.rotation += p.vRot;
        p.life = Math.max(0, 1 - elapsed / 2600);

        if (p.life > 0 && p.y < height + 30) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = p.life;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
          ctx.restore();
        }
      }

      if (alive) {
        rafId = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    rafId = requestAnimationFrame(frame);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [burstId]);

  if (!burstId) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[100] h-full w-full"
      aria-hidden="true"
    />
  );
}
