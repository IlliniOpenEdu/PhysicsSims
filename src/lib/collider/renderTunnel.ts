import { PARTICLE_COLORS } from './constants';
import type { ColliderControls, ColliderRuntime } from './types';
import { clamp, seededNoise, wrap01 } from './utils';

type Point = { x: number; y: number };

function bezierPoint(p0: Point, p1: Point, p2: Point, t: number): Point {
  const omt = 1 - t;
  return {
    x: omt * omt * p0.x + 2 * omt * t * p1.x + t * t * p2.x,
    y: omt * omt * p0.y + 2 * omt * t * p1.y + t * t * p2.y,
  };
}

function bezierTangent(p0: Point, p1: Point, p2: Point, t: number): Point {
  return {
    x: 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
    y: 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y),
  };
}

export function renderTunnel(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  runtime: ColliderRuntime,
  controls: ColliderControls
): void {
  const colors = PARTICLE_COLORS[controls.particleType];
  const glow = controls.tunnelGlow;
  const energyNorm = clamp(controls.beamEnergy / 100, 0, 1);
  const cameraDrift = Math.sin(runtime.time * 0.16) * 10;

  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#030712');
  bg.addColorStop(1, '#020617');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const p0 = { x: width * 0.5 + cameraDrift * 0.15, y: height * 0.9 };
  const p1 = { x: width * 0.2 + cameraDrift * 0.35, y: height * 0.55 };
  const p2 = { x: width * 0.68 + cameraDrift * 0.55, y: height * 0.12 };

  // Vanishing point glow
  const vanishGlow = ctx.createRadialGradient(p2.x, p2.y, 0, p2.x, p2.y, width * 0.35);
  vanishGlow.addColorStop(0, `rgba(56, 189, 248, ${0.12 + glow * 0.22 + energyNorm * 0.08})`);
  vanishGlow.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = vanishGlow;
  ctx.fillRect(0, 0, width, height);

  // Smooth cylindrical shell shading with structural ribs
  for (let i = 0; i < 30; i++) {
    const t = i / 29;
    const pt = bezierPoint(p0, p1, p2, t);
    const tg = bezierTangent(p0, p1, p2, t);
    const angle = Math.atan2(tg.y, tg.x) + Math.PI / 2;
    const radius = 72 * Math.pow(1 - t, 1.18) + 8;
    const depthFade = 1 - t;

    ctx.save();
    ctx.translate(pt.x, pt.y);
    ctx.rotate(angle);

    const shell = ctx.createLinearGradient(-radius, 0, radius, 0);
    shell.addColorStop(0, `rgba(15, 23, 42, ${0.9 - depthFade * 0.18})`);
    shell.addColorStop(0.5, `rgba(71, 85, 105, ${0.2 + depthFade * 0.18 + glow * 0.12})`);
    shell.addColorStop(1, `rgba(15, 23, 42, ${0.9 - depthFade * 0.18})`);
    ctx.strokeStyle = shell;
    ctx.lineWidth = 2.4 + depthFade * 4;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 1.14, radius * 0.76, 0, 0, Math.PI * 2);
    ctx.stroke();

    if (i % 2 === 0) {
      ctx.strokeStyle = `rgba(148, 163, 184, ${0.03 + depthFade * 0.08})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 1.04, radius * 0.7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Side guide lines
  const drawGuide = (side: number) => {
    ctx.beginPath();
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      const pt = bezierPoint(p0, p1, p2, t);
      const tg = bezierTangent(p0, p1, p2, t);
      const len = Math.hypot(tg.x, tg.y) || 1;
      const nx = -tg.y / len;
      const ny = tg.x / len;
      const radius = (65 * Math.pow(1 - t, 1.18) + 8) * 0.88;
      const x = pt.x + nx * radius * side;
      const y = pt.y + ny * radius * side;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  ctx.strokeStyle = `rgba(59, 130, 246, ${0.11 + glow * 0.26})`;
  ctx.lineWidth = 1.2;
  drawGuide(-1);
  drawGuide(1);

  // Longitudinal panel lines
  for (const side of [-0.45, 0, 0.45]) {
    ctx.beginPath();
    for (let i = 0; i <= 90; i++) {
      const t = i / 90;
      const pt = bezierPoint(p0, p1, p2, t);
      const tg = bezierTangent(p0, p1, p2, t);
      const len = Math.hypot(tg.x, tg.y) || 1;
      const nx = -tg.y / len;
      const ny = tg.x / len;
      const radius = (72 * Math.pow(1 - t, 1.18) + 8) * 0.9;
      const x = pt.x + nx * radius * side;
      const y = pt.y + ny * radius * side * 0.7;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(100, 116, 139, ${0.05 + (1 - Math.abs(side)) * 0.06})`;
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }

  // Beams: packets racing forward
  for (const bunch of runtime.bunches) {
    const base = wrap01(bunch.ringPosition + runtime.time * 0.08 * bunch.direction);
    const depth = 0.06 + base * 0.9;
    const pt = bezierPoint(p0, p1, p2, depth);
    const tg = bezierTangent(p0, p1, p2, depth);
    const len = Math.hypot(tg.x, tg.y) || 1;
    const nx = -tg.y / len;
    const ny = tg.x / len;

    const laneSide = bunch.direction === 1 ? -1 : 1;
    const laneWidth = 9 + (1 - depth) * 18;
    const x = pt.x + nx * laneWidth * laneSide;
    const y = pt.y + ny * laneWidth * laneSide * 0.72;

    const blurLength = 0.07 + energyNorm * 0.08;
    const trailPt = bezierPoint(p0, p1, p2, Math.max(0.02, depth - blurLength));
    const tx = trailPt.x + nx * laneWidth * laneSide;
    const ty = trailPt.y + ny * laneWidth * laneSide * 0.72;

    const color = bunch.direction === 1 ? colors.cw : colors.ccw;
    const depthFade = clamp(1 - depth * 0.62, 0.2, 1);
    const alpha = clamp((0.28 + bunch.brightness * 0.5 + glow * 0.18) * depthFade, 0.18, 0.95);

    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1 + (1 - depth) * 2.6;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(x, y);
    ctx.stroke();

    const r = 1.1 + (1 - depth) * 3.1;
    const glowGrad = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    glowGrad.addColorStop(0, color);
    glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(x, y, r * 4, 0, Math.PI * 2);
    ctx.fill();

    // Beam light reflecting on tunnel walls
    ctx.strokeStyle = color;
    ctx.globalAlpha = clamp(0.07 + glow * 0.12 + energyNorm * 0.07, 0.05, 0.26) * depthFade;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - nx * 16, y - ny * 10);
    ctx.lineTo(x + nx * 16, y + ny * 10);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Collision flare near far detector region
  const activeCollision = runtime.collisions.find((c) => c.age < 0.4);
  if (activeCollision) {
    const flareT = 0.78;
    const f = bezierPoint(p0, p1, p2, flareT);
    const pulse = 1 - activeCollision.age / 0.4;
    const radius = 18 + pulse * 48;
    const flare = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, radius);
    flare.addColorStop(0, `rgba(250, 204, 21, ${0.52 * pulse})`);
    flare.addColorStop(1, 'rgba(250, 204, 21, 0)');
    ctx.fillStyle = flare;
    ctx.beginPath();
    ctx.arc(f.x, f.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Depth fog (far end darker)
  const fog = ctx.createLinearGradient(0, 0, 0, height);
  fog.addColorStop(0, 'rgba(2, 6, 23, 0.46)');
  fog.addColorStop(0.45, 'rgba(2, 6, 23, 0.16)');
  fog.addColorStop(1, 'rgba(2, 6, 23, 0)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, width, height);

  // Subtle texture pass
  ctx.fillStyle = 'rgba(148, 163, 184, 0.04)';
  for (let i = 0; i < 170; i++) {
    const x = seededNoise(i * 2.1 + runtime.time * 0.1) * width;
    const y = seededNoise(i * 3.7 + runtime.time * 0.07) * height;
    ctx.fillRect(x, y, 1, 1);
  }

  if (energyNorm > 0.75) {
    const pulse = Math.sin(runtime.time * 8.5) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(56, 189, 248, ${0.03 + pulse * 0.06})`;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.fillText('In-tunnel view · deep beamline perspective', 14, 20);
}
