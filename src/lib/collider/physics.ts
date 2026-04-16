import {
  ACCELERATION_SECTORS,
  DETECTOR_POINTS,
  MAX_LOGS,
  PARTICLE_COLORS,
} from './constants';
import type {
  BeamBunch,
  ColliderControls,
  ColliderLog,
  ColliderRuntime,
  CollisionEvent,
  DetectorPoint,
  TrackFragment,
} from './types';
import { clamp, ringDistance, ringInSector, smooth, wrap01 } from './utils';

let nextBunchId = 1;
let nextEventId = 1;
let nextLogId = 1;

function makeTrackFragments(intensity: number, count: number, accent: string): TrackFragment[] {
  const tracks: TrackFragment[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.16;
    tracks.push({
      angle,
      speed: 0.35 + Math.random() * 0.5 + intensity * 0.3,
      curvature: (Math.random() - 0.5) * (0.08 + intensity * 0.16),
      life: 0,
      maxLife: 0.14 + Math.random() * 0.11,
      color: accent,
    });
  }
  return tracks;
}

export function createLog(kind: ColliderLog['kind'], time: number, text: string): ColliderLog {
  return { id: nextLogId++, kind, time, text };
}

export function pushLog(runtime: ColliderRuntime, log: ColliderLog): void {
  runtime.logs = [log, ...runtime.logs].slice(0, MAX_LOGS);
}

export function createInitialBunches(controls: ColliderControls): BeamBunch[] {
  const bunches: BeamBunch[] = [];
  const colors = PARTICLE_COLORS[controls.particleType];
  const clusters = Math.max(2, Math.ceil(controls.bunchCount / 3));
  const positions: number[] = [];

  for (let i = 0; i < clusters; i++) {
    const clusterCenter = (i + Math.random() * 0.15) / clusters;
    const inCluster = Math.min(3, controls.bunchCount - positions.length);
    for (let j = 0; j < inCluster; j++) {
      const clusterSpread = 0.01 + controls.bunchCount * 0.00025;
      const jitter = (Math.random() - 0.5) * clusterSpread;
      positions.push(wrap01(clusterCenter + (j - (inCluster - 1) / 2) * 0.012 + jitter));
      if (positions.length >= controls.bunchCount) break;
    }
    if (positions.length >= controls.bunchCount) break;
  }

  while (positions.length < controls.bunchCount) {
    positions.push(wrap01(Math.random()));
  }

  positions.sort((a, b) => a - b);

  for (let i = 0; i < controls.bunchCount; i++) {
    const phase = positions[i];
    const oppositeJitter = (Math.random() - 0.5) * 0.01;
    bunches.push({
      id: nextBunchId++,
      ringPosition: wrap01(phase),
      direction: 1,
      energy: controls.beamEnergy,
      brightness: 0.45,
      trailStrength: 0.3,
      jitterSeed: Math.random() * 1000,
    });
    bunches.push({
      id: nextBunchId++,
      ringPosition: wrap01(phase + 0.5 + oppositeJitter),
      direction: -1,
      energy: controls.beamEnergy,
      brightness: 0.45,
      trailStrength: 0.3,
      jitterSeed: Math.random() * 1000,
    });
  }

  // Avoid unused colors var when tree-shaken in some bundlers.
  void colors;

  return bunches;
}

export function createInitialRuntime(controls: ColliderControls): ColliderRuntime {
  return {
    time: 0,
    bunches: createInitialBunches(controls),
    collisions: [],
    logs: [createLog('system', 0, 'Collider initialized')],
    collisionRate: 0,
    nextCollisionAllowedAt: 0,
    nextCollisionLogAt: 0,
  };
}

function bunchSpeedTurnsPerSec(controls: ColliderControls, bunchEnergy: number): number {
  const energyNorm = clamp(controls.beamEnergy / 100, 0, 1);
  const fieldNorm = clamp((controls.magneticField - 1) / 9, 0, 1);
  const localEnergy = clamp(bunchEnergy / 100, 0, 1);
  return 0.055 + energyNorm * 0.34 + localEnergy * 0.13 + fieldNorm * 0.04;
}

function detectorNearPairs(
  bunches: BeamBunch[],
  detector: DetectorPoint,
  window: number
): { cw: BeamBunch | null; ccw: BeamBunch | null } {
  let cw: BeamBunch | null = null;
  let ccw: BeamBunch | null = null;
  let bestCw = Number.POSITIVE_INFINITY;
  let bestCcw = Number.POSITIVE_INFINITY;

  for (const b of bunches) {
    const d = ringDistance(b.ringPosition, detector.ringPosition);
    if (d > window) continue;

    if (b.direction === 1 && d < bestCw) {
      bestCw = d;
      cw = b;
    }
    if (b.direction === -1 && d < bestCcw) {
      bestCcw = d;
      ccw = b;
    }
  }

  return { cw, ccw };
}

export function updateSimulation(runtime: ColliderRuntime, controls: ColliderControls, dt: number): void {
  runtime.time += dt;

  const detectorWindow = 0.012 + (1 - controls.detectorSensitivity) * 0.008;
  const accelGain = 22 * dt;

  for (const bunch of runtime.bunches) {
    const baseSpeed = bunchSpeedTurnsPerSec(controls, bunch.energy);
    const isInAccel = ACCELERATION_SECTORS.some((s) =>
      ringInSector(bunch.ringPosition, s.start, s.end)
    );

    if (isInAccel) {
      bunch.energy = clamp(bunch.energy + accelGain, 5, 140);
    } else {
      bunch.energy = smooth(bunch.energy, controls.beamEnergy, 3.2, dt);
    }

    bunch.ringPosition = wrap01(bunch.ringPosition + baseSpeed * dt * bunch.direction);

    const energyNorm = clamp(bunch.energy / 100, 0, 1.2);
    bunch.brightness = smooth(bunch.brightness, 0.35 + energyNorm * 0.8, 8, dt);
    bunch.trailStrength = smooth(
      bunch.trailStrength,
      0.18 + energyNorm * 0.65 + controls.tunnelGlow * 0.2,
      7,
      dt
    );
  }

  if (controls.collisionsEnabled && runtime.time >= runtime.nextCollisionAllowedAt) {
    const maxActiveCollisions = controls.beamEnergy >= 72 ? 2 : 1;
    const activeCollisions = runtime.collisions.filter((c) => c.age < c.duration).length;
    if (activeCollisions >= maxActiveCollisions) {
      runtime.collisionRate = smooth(runtime.collisionRate, activeCollisions * 1.4, 4, dt);
      return;
    }

    for (const detector of DETECTOR_POINTS) {
      const { cw, ccw } = detectorNearPairs(runtime.bunches, detector, detectorWindow);
      if (!cw || !ccw) continue;

      const overlap = 1 - clamp(ringDistance(cw.ringPosition, ccw.ringPosition) / detectorWindow, 0, 1);
      const energyMix = clamp((cw.energy + ccw.energy) / 220, 0, 1.4);
      const chance = clamp((0.14 + controls.detectorSensitivity * 0.42) * overlap * (0.5 + energyMix), 0, 0.9);

      if (Math.random() < chance) {
        const intensity = clamp(0.35 + energyMix * 1.05 + controls.beamEnergy / 180, 0.3, 2.1);
        const accent = PARTICLE_COLORS[controls.particleType].accent;
        const trackCount = Math.round(8 + controls.detectorSensitivity * 4);
        const event: CollisionEvent = {
          id: nextEventId++,
          detectorId: detector.id,
          ringPosition: detector.ringPosition,
          intensity,
          age: 0,
          duration: 0.26,
          pulseDirection: Math.random() > 0.5 ? 1 : -1,
          tracks: makeTrackFragments(intensity, trackCount, accent),
        };
        runtime.collisions.push(event);
        runtime.collisionRate = smooth(runtime.collisionRate, intensity * 4.2, 7, dt);
        runtime.nextCollisionAllowedAt = runtime.time + (0.22 + Math.random() * 0.55);
        if (runtime.time >= runtime.nextCollisionLogAt) {
          pushLog(
            runtime,
            createLog(
              'collision',
              runtime.time,
              `Detector ${detector.name}: impact E~${Math.round(intensity * 100)} arb`
            )
          );
          runtime.nextCollisionLogAt = runtime.time + 0.8;
        }
        break;
      }
    }
  } else {
    runtime.collisionRate = smooth(runtime.collisionRate, 0, 1.8, dt);
  }

  runtime.collisions = runtime.collisions
    .map((event) => {
      const nextAge = event.age + dt;
      const tracks = event.tracks
        .map((t) => ({ ...t, life: t.life + dt }))
        .filter((t) => t.life <= t.maxLife);
      return { ...event, age: nextAge, tracks };
    })
    .filter((event) => event.age <= event.duration || event.tracks.length > 0);
}
