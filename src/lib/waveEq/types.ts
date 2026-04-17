export type WaveMode = 'traveling' | 'standing' | 'em';

export type EMDisplayMode = 'textbook' | 'volume';

export type NavigationMode = 'orbit' | 'fly';

export type WaveParams = {
  amplitude: number;
  wavelength: number;
  frequency: number;
  phase: number;
  samples: number;
  domainStart: number;
  domainEnd: number;
  playbackSpeed?: number;
  eAmplitude?: number;
  bAmplitude?: number;
  arrowSpacing?: number;
  arrowScale?: number;
  showFieldArrows?: boolean;
  showProbe?: boolean;
  probeX?: number;
  volumeXCount?: number;
  volumeYCount?: number;
  volumeZCount?: number;
  volumeXSpan?: number;
  volumeYSpan?: number;
  volumeZSpan?: number;
  volumeArrowScale?: number;
  volumeShowElectric?: boolean;
  volumeShowMagnetic?: boolean;
  volumeSkipNearZero?: boolean;
  volumeMinMagnitude?: number;
};

export type SamplePoint = {
  x: number;
  y: number;
  z: number;
};

export type EMWaveSample = {
  z: number;
  e: number;
  b: number;
};

export type EMArrowSample = {
  z: number;
  e: number;
  b: number;
};

export type EMVolumeSample = {
  x: number;
  y: number;
  z: number;
  e: number;
  b: number;
};
