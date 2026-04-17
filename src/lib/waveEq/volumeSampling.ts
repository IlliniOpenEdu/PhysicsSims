import type { EMVolumeSample, WaveParams } from './types.ts';
import { getAngularFrequency, getWaveNumber } from './wave.ts';

const DEFAULT_X_COUNT = 5;
const DEFAULT_Y_COUNT = 5;
const DEFAULT_Z_COUNT = 20;
const DEFAULT_X_SPAN = 8;
const DEFAULT_Y_SPAN = 8;
const DEFAULT_Z_SPAN = 40;

const makeAxisSamples = (count: number, span: number): number[] => {
  const resolvedCount = Math.max(2, Math.floor(count));
  const resolvedSpan = Math.max(0.01, span);
  const step = resolvedCount === 1 ? 0 : resolvedSpan / (resolvedCount - 1);
  const start = -resolvedSpan / 2;
  const values = new Array<number>(resolvedCount);

  for (let i = 0; i < resolvedCount; i += 1) {
    values[i] = start + i * step;
  }

  return values;
};

export function sampleEMSliceField(
  z: number,
  t: number,
  params: WaveParams,
  xCount: number,
  yCount: number,
  xSpan: number,
  ySpan: number,
): EMVolumeSample[] {
  const xs = makeAxisSamples(xCount, xSpan);
  const ys = makeAxisSamples(yCount, ySpan);
  const k = getWaveNumber(params.wavelength);
  const omega = getAngularFrequency(params.frequency);
  const eAmp = params.eAmplitude ?? params.amplitude;
  const bAmp = params.bAmplitude ?? params.amplitude * 0.7;
  const oscillation = Math.sin(k * z - omega * t + params.phase);
  const samples: EMVolumeSample[] = new Array(xs.length * ys.length);

  let index = 0;
  for (let yi = 0; yi < ys.length; yi += 1) {
    for (let xi = 0; xi < xs.length; xi += 1) {
      samples[index] = {
        x: xs[xi],
        y: ys[yi],
        z,
        e: eAmp * oscillation,
        b: bAmp * oscillation,
      };
      index += 1;
    }
  }

  return samples;
}

export function sampleEMFieldVolume(t: number, params: WaveParams): EMVolumeSample[] {
  const xCount = params.volumeXCount ?? DEFAULT_X_COUNT;
  const yCount = params.volumeYCount ?? DEFAULT_Y_COUNT;
  const zCount = params.volumeZCount ?? DEFAULT_Z_COUNT;
  const xSpan = params.volumeXSpan ?? DEFAULT_X_SPAN;
  const ySpan = params.volumeYSpan ?? DEFAULT_Y_SPAN;
  const zSpan = params.volumeZSpan ?? DEFAULT_Z_SPAN;
  const zs = makeAxisSamples(zCount, zSpan);
  const samples: EMVolumeSample[] = [];

  for (let zi = 0; zi < zs.length; zi += 1) {
    const slice = sampleEMSliceField(zs[zi], t, params, xCount, yCount, xSpan, ySpan);
    samples.push(...slice);
  }

  return samples;
}
