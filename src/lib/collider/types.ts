export type ParticleType = 'proton' | 'electron' | 'ion';

export type ViewMode = 'ring' | 'tunnel';

export type LogKind = 'system' | 'beam' | 'collision' | 'detector';

export type BeamDirection = 1 | -1;

export type ColliderControls = {
  beamEnergy: number;
  magneticField: number;
  particleType: ParticleType;
  bunchCount: number;
  collisionsEnabled: boolean;
  detectorSensitivity: number;
  tunnelGlow: number;
};

export type BeamBunch = {
  id: number;
  ringPosition: number; // 0..1 around the collider ring
  direction: BeamDirection;
  energy: number;
  brightness: number;
  trailStrength: number;
  jitterSeed: number;
};

export type TrackFragment = {
  angle: number;
  speed: number;
  curvature: number;
  life: number;
  maxLife: number;
  color: string;
};

export type CollisionEvent = {
  id: number;
  detectorId: string;
  ringPosition: number;
  intensity: number;
  age: number;
  duration: number;
  pulseDirection: BeamDirection;
  tracks: TrackFragment[];
};

export type DetectorPoint = {
  id: string;
  name: string;
  ringPosition: number;
};

export type AccelerationSector = {
  id: string;
  start: number;
  end: number;
};

export type ColliderLog = {
  id: number;
  kind: LogKind;
  time: number;
  text: string;
};

export type ColliderRuntime = {
  time: number;
  bunches: BeamBunch[];
  collisions: CollisionEvent[];
  logs: ColliderLog[];
  collisionRate: number;
  nextCollisionAllowedAt: number;
  nextCollisionLogAt: number;
};

export type ColliderSnapshot = {
  time: number;
  collisionRate: number;
  collisionsActive: number;
  logs: ColliderLog[];
};
