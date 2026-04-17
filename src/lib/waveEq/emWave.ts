import type { EMArrowSample, EMWaveSample, WaveParams } from './types.ts';
import { getAngularFrequency, getWaveNumber } from './wave.ts';
export { sampleEMFieldVolume, sampleEMSliceField } from './volumeSampling.ts';

export function sampleElectromagneticWave(t: number, params: WaveParams): EMWaveSample[] {
  const sampleCount = Math.max(2, params.samples);
  const domainSpan = params.domainEnd - params.domainStart;
  const step = domainSpan / (sampleCount - 1);
  const k = getWaveNumber(params.wavelength);
  const omega = getAngularFrequency(params.frequency);
  const eAmp = params.eAmplitude ?? params.amplitude;
  const bAmp = params.bAmplitude ?? params.amplitude * 0.7;
  const samples: EMWaveSample[] = new Array(sampleCount);

  for (let i = 0; i < sampleCount; i += 1) {
    const z = params.domainStart + i * step;
    const oscillation = Math.sin(k * z - omega * t + params.phase);
    samples[i] = {
      z,
      e: eAmp * oscillation,
      b: bAmp * oscillation,
    };
  }

  return samples;
}

export function sampleEMFieldArrows(t: number, params: WaveParams): EMArrowSample[] {
  const spacing = Math.max(0.35, params.arrowSpacing ?? 1.2);
  const count = Math.max(2, Math.floor((params.domainEnd - params.domainStart) / spacing) + 1);
  const k = getWaveNumber(params.wavelength);
  const omega = getAngularFrequency(params.frequency);
  const eAmp = params.eAmplitude ?? params.amplitude;
  const bAmp = params.bAmplitude ?? params.amplitude * 0.7;
  const out: EMArrowSample[] = new Array(count);

  for (let i = 0; i < count; i += 1) {
    const z = params.domainStart + i * spacing;
    const clampedZ = z > params.domainEnd ? params.domainEnd : z;
    const oscillation = Math.sin(k * clampedZ - omega * t + params.phase);
    out[i] = {
      z: clampedZ,
      e: eAmp * oscillation,
      b: bAmp * oscillation,
    };
  }

  return out;
}
