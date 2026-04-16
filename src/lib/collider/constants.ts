import type { AccelerationSector, ColliderControls, DetectorPoint, ParticleType } from './types';

export const DEFAULT_CONTROLS: ColliderControls = {
  beamEnergy: 65,
  magneticField: 7,
  particleType: 'proton',
  bunchCount: 10,
  collisionsEnabled: true,
  detectorSensitivity: 0.65,
  tunnelGlow: 0.7,
};

export const MIN_CONTROLS: ColliderControls = {
  beamEnergy: 5,
  magneticField: 1,
  particleType: 'proton',
  bunchCount: 2,
  collisionsEnabled: false,
  detectorSensitivity: 0,
  tunnelGlow: 0,
};

export const MAX_CONTROLS: ColliderControls = {
  beamEnergy: 100,
  magneticField: 10,
  particleType: 'proton',
  bunchCount: 24,
  collisionsEnabled: true,
  detectorSensitivity: 1,
  tunnelGlow: 1,
};

export const DETECTOR_POINTS: DetectorPoint[] = [
  { id: 'atlas', name: 'ATLAS', ringPosition: 0.02 },
  { id: 'cms', name: 'CMS', ringPosition: 0.52 },
  { id: 'alice', name: 'ALICE', ringPosition: 0.77 },
  { id: 'lhcb', name: 'LHCb', ringPosition: 0.27 },
];

export const ACCELERATION_SECTORS: AccelerationSector[] = [
  { id: 'rf-a', start: 0.1, end: 0.18 },
  { id: 'rf-b', start: 0.34, end: 0.41 },
  { id: 'rf-c', start: 0.58, end: 0.65 },
  { id: 'rf-d', start: 0.83, end: 0.9 },
];

export const PARTICLE_COLORS: Record<ParticleType, { cw: string; ccw: string; accent: string }> = {
  proton: { cw: '#38bdf8', ccw: '#fb7185', accent: '#facc15' },
  electron: { cw: '#22d3ee', ccw: '#f472b6', accent: '#93c5fd' },
  ion: { cw: '#60a5fa', ccw: '#fb923c', accent: '#fde047' },
};

export const COLLIDER_LABEL = 'Particle Collider Explorer';

export const MAX_LOGS = 8;
