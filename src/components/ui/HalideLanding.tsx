import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassButton } from './apple-tahoe-liquid-glass-button';

const HalideLanding: React.FC = () => {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      const x = (window.innerWidth / 2 - e.pageX) / 25;
      const y = (window.innerHeight / 2 - e.pageY) / 25;

      canvas.style.transform = `rotateX(${55 + y / 2}deg) rotateZ(${-25 + x / 2}deg)`;

      layersRef.current.forEach((layer, index) => {
        if (!layer) return;
        const depth = (index + 1) * 15;
        const moveX = x * (index + 1) * 0.2;
        const moveY = y * (index + 1) * 0.2;
        layer.style.transform = `translateZ(${depth}px) translate(${moveX}px, ${moveY}px)`;
      });
    };

    canvas.style.opacity = '0';
    canvas.style.transform = 'rotateX(90deg) rotateZ(0deg) scale(0.8)';

    const timeout = setTimeout(() => {
      canvas.style.transition = 'all 2.5s cubic-bezier(0.16, 1, 0.3, 1)';
      canvas.style.opacity = '1';
      canvas.style.transform = 'rotateX(55deg) rotateZ(-25deg) scale(1)';
    }, 300);

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syncopate:wght@400;700&display=swap');

        :root {
          --bg: #030507;
          --silver: #93c5fd;
          --accent: #22d3ee;
          --grain-opacity: 0.1;
        }

        .halide-body {
          position: relative;
          background-color: var(--bg);
          color: var(--silver);
          font-family: 'Syncopate', sans-serif;
          overflow: hidden;
          height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .halide-grain {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          pointer-events: none;
          z-index: 100;
          opacity: var(--grain-opacity);
        }

        .halide-viewport {
          perspective: 2000px;
          width: 100%;
          height: 100%;
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .canvas-3d {
          position: relative;
          width: 800px;
          height: 500px;
          transform-style: preserve-3d;
          transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .halide-layer {
          position: absolute;
          inset: 0;
          border: 1px solid rgba(96, 165, 250, 0.15);
          background-size: cover;
          background-position: center;
          transition: transform 0.5s ease;
        }

        .halide-layer-1 {
          background-image: url('https://images.unsplash.com/photo-1446776877081-d282a0f896e2?auto=format&fit=crop&q=80&w=1200');
          filter: grayscale(1) contrast(1.2) brightness(0.45);
        }
        .halide-layer-2 {
          background-image: url('https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&q=80&w=1200');
          filter: grayscale(1) contrast(1.1) brightness(0.7);
          opacity: 0.6;
          mix-blend-mode: screen;
        }
        .halide-layer-3 {
          background-image: url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=1200');
          filter: grayscale(1) contrast(1.3) brightness(0.8);
          opacity: 0.4;
          mix-blend-mode: overlay;
        }

        .halide-contours {
          position: absolute;
          width: 200%;
          height: 200%;
          top: -50%;
          left: -50%;
          background-image: repeating-radial-gradient(
            circle at 50% 50%,
            transparent 0,
            transparent 40px,
            rgba(96, 165, 250, 0.07) 41px,
            transparent 42px
          );
          transform: translateZ(120px);
          pointer-events: none;
        }

        .halide-interface-grid {
          position: absolute;
          inset: 0;
          padding: 4rem;
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: auto 1fr auto;
          z-index: 10;
          pointer-events: none;
        }

        .halide-hero-title {
          grid-column: 1 / -1;
          align-self: center;
          font-size: clamp(3rem, 10vw, 10rem);
          line-height: 0.85;
          letter-spacing: -0.04em;
          mix-blend-mode: difference;
        }

        .halide-scroll-hint {
          position: absolute;
          bottom: 2rem;
          left: 50%;
          width: 1px;
          height: 60px;
          background: linear-gradient(to bottom, var(--silver), transparent);
          animation: halide-flow 2s infinite ease-in-out;
        }

        @keyframes halide-flow {
          0%, 100% { transform: scaleY(0); transform-origin: top; }
          50% { transform: scaleY(1); transform-origin: top; }
          51% { transform: scaleY(1); transform-origin: bottom; }
        }
      `}</style>

      <div className="halide-body">
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
          <filter id="halide-grain-filter">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </svg>

        <div className="halide-grain" style={{ filter: 'url(#halide-grain-filter)' }} />

        <div className="halide-interface-grid">
          <div style={{ fontWeight: 700 }}>ILLINI OPEN EDU</div>
          <div style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--accent)', fontSize: '0.7rem' }}>
            <div>E: 13.6 TeV</div>
            <div>c: 2.998 × 10⁸ m/s</div>
          </div>

          <h1 className="halide-hero-title">
            REAL TIME
            <br />
            PHYSICS
          </h1>

          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
              <p>[ E&amp;M · MECHANICS · THERMAL ]</p>
              <p>25+ INTERACTIVE SIMULATIONS</p>
            </div>
            <div style={{ pointerEvents: 'auto' }}>
              <GlassButton
                size="lg"
                onClick={() => navigate('/dashboard')}
                glassColor="rgba(147,197,253,0.08)"
                style={{ fontFamily: "'Syncopate', sans-serif", letterSpacing: '0.05em' }}
              >
                OPEN A LAB
              </GlassButton>
            </div>
          </div>
        </div>

        <div className="halide-viewport">
          <div className="canvas-3d" ref={canvasRef}>
            <div className="halide-layer halide-layer-1" ref={(el) => { if (el) layersRef.current[0] = el; }} />
            <div className="halide-layer halide-layer-2" ref={(el) => { if (el) layersRef.current[1] = el; }} />
            <div className="halide-layer halide-layer-3" ref={(el) => { if (el) layersRef.current[2] = el; }} />
            <div className="halide-contours" />
          </div>
        </div>

        <div className="halide-scroll-hint" />
      </div>
    </>
  );
};

export default HalideLanding;