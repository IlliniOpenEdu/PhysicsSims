import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { renderTunnel } from '../../lib/collider/renderTunnel';
import type { ColliderControls, ColliderRuntime } from '../../lib/collider/types';

type TunnelViewCanvasProps = {
  runtimeRef: MutableRefObject<ColliderRuntime>;
  controls: ColliderControls;
};

export function TunnelViewCanvas({ runtimeRef, controls }: TunnelViewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      renderTunnel(ctx, rect.width, rect.height, runtimeRef.current, controls);
      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);

    return () => {
      observer.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [controls, runtimeRef]);

  return (
    <div className="relative h-[28rem] overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950 shadow-2xl shadow-slate-950/60 sm:h-[34rem]">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
