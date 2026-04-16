import { ACCELERATION_SECTORS, DETECTOR_POINTS, PARTICLE_COLORS } from './constants';
import type { ColliderControls, ColliderRuntime } from './types';
import { clamp, seededNoise, wrap01 } from './utils';

type Point = { x: number; y: number };

function pointOnRing(cx: number, cy: number, r: number, t01: number): Point {
  const a = t01 * Math.PI * 2 - Math.PI / 2;
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
}

function depthAtRingPosition(position: number): number {
  const a = position * Math.PI * 2 - Math.PI / 2;
  const nearFactor = (Math.sin(a) + 1) * 0.5;
  return 0.52 + nearFactor * 0.48;
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, time: number): void {
  const bg = ctx.createRadialGradient(w * 0.5, h * 0.45, 10, w * 0.5, h * 0.45, w * 0.7);
  bg.addColorStop(0, '#04122f');
  bg.addColorStop(1, '#020617');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#cbd5e1';
  for (let i = 0; i < 180; i++) {
    const x = seededNoise(i * 7.1 + time * 0.2) * w;
    const y = seededNoise(i * 4.7 + time * 0.16) * h;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.restore();
}

function drawBeamTrail(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  position: number,
  direction: 1 | -1,
  color: string,
  strength: number
): void {
  const length = clamp(0.03 + strength * 0.11, 0.02, 0.16);
  const segments = 14;
  for (let i = 0; i < segments; i++) {
    const t = i / (segments - 1);
    const local = wrap01(position - direction * t * length);
    const p = pointOnRing(cx, cy, radius, local);
    ctx.globalAlpha = (1 - t) * clamp(strength, 0.2, 1);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.4 - t * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function renderRing(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  runtime: ColliderRuntime,
  controls: ColliderControls
): void {
  drawBackground(ctx, width, height, runtime.time);

  const cx = width * 0.5;
  const cy = height * 0.5;
  const ringR = Math.min(width, height) * 0.34;

  const colors = PARTICLE_COLORS[controls.particleType];
  const magNorm = clamp((controls.magneticField - 1) / 9, 0, 1);
  const energyNorm = clamp(controls.beamEnergy / 100, 0, 1);
  const highEnergyPulse = energyNorm > 0.72 ? Math.sin(runtime.time * 8) * 0.5 + 0.5 : 0;

  // Layer 1: inner thin beam pipe (bright, no center artifacts)
  ctx.strokeStyle = `rgba(191, 219, 254, ${0.55 + energyNorm * 0.3})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, ringR - 12, 0, Math.PI * 2);
  ctx.stroke();

  // Layer 2: beam path ring
  ctx.strokeStyle = `rgba(148, 163, 184, ${0.2 + energyNorm * 0.2})`;
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
  ctx.stroke();

  // Layer 3: outer segmented machine ring (alternate dim/bright)
  const segmentCount = 72;
  for (let i = 0; i < segmentCount; i++) {
    const start = (i / segmentCount) * Math.PI * 2;
    const end = start + (Math.PI * 2) / segmentCount * 0.66;
    const alt = i % 2 === 0 ? 0.24 : 0.12;
    const sweep = Math.sin(runtime.time * 2.5 - i * 0.22) * 0.08;
    const alpha = clamp(alt + magNorm * 0.45 + sweep + highEnergyPulse * 0.08, 0.08, 0.86);
    ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
    ctx.lineWidth = 5.4;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR + 20, start, end);
    ctx.stroke();
  }

  // Continuous subtle machine pulse traveling around ring
  const machinePulsePos = wrap01(runtime.time * (0.05 + magNorm * 0.04));
  ctx.strokeStyle = `rgba(125, 211, 252, ${0.32 + magNorm * 0.25})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(
    cx,
    cy,
    ringR + 20,
    machinePulsePos * Math.PI * 2 - Math.PI / 2 - 0.12,
    machinePulsePos * Math.PI * 2 - Math.PI / 2 + 0.12
  );
  ctx.stroke();

  // Acceleration sectors
  for (const sector of ACCELERATION_SECTORS) {
    const activeBunches = runtime.bunches.filter((b) => {
      const rel = wrap01(b.ringPosition);
      return rel >= sector.start && rel <= sector.end;
    }).length;
    const passPulse = clamp(activeBunches / Math.max(1, controls.bunchCount), 0, 1);
    const pulse = 0.45 + Math.sin(runtime.time * 8 + sector.start * 35) * 0.2;
    const alpha = clamp(0.14 + energyNorm * 0.44 * pulse + passPulse * 0.42, 0.12, 0.78);
    ctx.strokeStyle = `rgba(16, 185, 129, ${alpha})`;
    ctx.lineWidth = 5.2;
    ctx.beginPath();
    ctx.arc(
      cx,
      cy,
      ringR,
      sector.start * Math.PI * 2 - Math.PI / 2,
      sector.end * Math.PI * 2 - Math.PI / 2
    );
    ctx.stroke();
  }

  // Detector points
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  for (const detector of DETECTOR_POINTS) {
    const p = pointOnRing(cx, cy, ringR, detector.ringPosition);
    const nearby = runtime.collisions.some(
      (c) => c.detectorId === detector.id && c.age < 0.35
    );
    ctx.fillStyle = nearby ? 'rgba(251, 191, 36, 1)' : 'rgba(251, 191, 36, 0.72)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, nearby ? 4.2 : 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
    ctx.fillText(detector.name, p.x + 7, p.y - 7);
  }

  // Beam bunches: clustered packets with tiny jitter and energy-linked trails
  for (const bunch of runtime.bunches) {
    const color = bunch.direction === 1 ? colors.cw : colors.ccw;
    const fieldTightness = clamp((controls.magneticField - 1) / 9, 0, 1);
    const jitterMag = (1 - fieldTightness) * 0.0025;
    const jitter = (seededNoise(bunch.jitterSeed + runtime.time * 18) - 0.5) * jitterMag;
    const renderPos = wrap01(bunch.ringPosition + jitter);
    const depth = depthAtRingPosition(renderPos);

    const brightnessNoise = 0.82 + seededNoise(bunch.jitterSeed * 0.37) * 0.26;
    drawBeamTrail(
      ctx,
      cx,
      cy,
      ringR,
      renderPos,
      bunch.direction,
      color,
      bunch.trailStrength * (0.82 + energyNorm * 0.5)
    );
    const p = pointOnRing(cx, cy, ringR, renderPos);

    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 10 + bunch.brightness * 10);
    glow.addColorStop(0, color);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = clamp((0.35 + bunch.brightness * 0.55) * depth * brightnessNoise, 0.3, 0.98);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 9 + bunch.brightness * 7, 0, Math.PI * 2);
    ctx.fill();

    // Soft beam light on ring surface
    ctx.globalAlpha = clamp(0.18 + energyNorm * 0.18, 0.08, 0.4);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR + 2, renderPos * Math.PI * 2 - Math.PI / 2 - 0.025, renderPos * Math.PI * 2 - Math.PI / 2 + 0.025);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.2 + bunch.brightness * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Collision system: flash core, tight bloom, burst tracks, shockwave, detector pulse
  for (const event of runtime.collisions) {
    const c = pointOnRing(cx, cy, ringR, event.ringPosition);
    const intensity = event.intensity;
    const t = clamp(event.age / event.duration, 0, 1);
    const fade = 1 - t;

    if (event.age <= 0.028) {
      ctx.fillStyle = `rgba(255,255,255,${0.85 * fade})`;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 2.2 + intensity * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    const bloom = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 16 + intensity * 18);
    bloom.addColorStop(0, `rgba(250, 245, 165, ${0.65 * fade})`);
    bloom.addColorStop(0.7, `rgba(250, 204, 21, ${0.3 * fade})`);
    bloom.addColorStop(1, 'rgba(250, 204, 21, 0)');
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 16 + intensity * 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(254, 240, 138, ${0.75 * fade})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 6 + t * (18 + intensity * 10), 0, Math.PI * 2);
    ctx.stroke();

    for (const track of event.tracks) {
      const lt = clamp(track.life / track.maxLife, 0, 1);
      const lf = 1 - lt;
      const steps = 9;
      ctx.strokeStyle = track.color;
      ctx.globalAlpha = lf * (0.45 + controls.detectorSensitivity * 0.55);
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const st = i / steps;
        const dist = (track.speed * lt + st * 0.5) * ringR * 0.18;
        const a = track.angle + track.curvature * st * st;
        const x = c.x + Math.cos(a) * dist;
        const y = c.y + Math.sin(a) * dist;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const detectorPulsePos = wrap01(event.ringPosition + event.pulseDirection * t * 0.11);
    const detectorPulse = pointOnRing(cx, cy, ringR + 20, detectorPulsePos);
    ctx.strokeStyle = `rgba(250, 204, 21, ${0.45 * fade * controls.detectorSensitivity})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(
      cx,
      cy,
      ringR + 20,
      detectorPulsePos * Math.PI * 2 - Math.PI / 2 - 0.035,
      detectorPulsePos * Math.PI * 2 - Math.PI / 2 + 0.035
    );
    ctx.stroke();

    ctx.fillStyle = `rgba(250, 204, 21, ${0.45 * fade * controls.detectorSensitivity})`;
    ctx.beginPath();
    ctx.arc(detectorPulse.x, detectorPulse.y, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // High energy global pulse for "wow" moment
  if (energyNorm > 0.76) {
    const pulse = 0.08 + highEnergyPulse * 0.1;
    const halo = ctx.createRadialGradient(cx, cy, ringR * 0.7, cx, cy, ringR * 1.4);
    halo.addColorStop(0, `rgba(56, 189, 248, ${pulse})`);
    halo.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle noise texture
  ctx.fillStyle = 'rgba(148, 163, 184, 0.06)';
  for (let i = 0; i < 140; i++) {
    const n = seededNoise(i * 0.37 + runtime.time * 0.15);
    const x = n * width;
    const y = seededNoise(i * 0.81 + runtime.time * 0.12) * height;
    ctx.fillRect(x, y, 1, 1);
  }
}
