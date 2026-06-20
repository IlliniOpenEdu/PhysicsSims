import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConceptBox } from '../../../components/ConceptBox';
import { SliderWithInput } from '../../../components/SliderWithInput';
import { C_SOUND, TWO_PI } from '../../../utils/constants';
import { formatSI, formatTime } from '../../../utils/formatters';

type Mode = 'tone' | 'mic';
type MicStatus = 'idle' | 'requesting' | 'listening' | 'error';

const CANVAS_WIDTH = 920;
const CANVAS_HEIGHT = 320;
const FFT_SIZE = 4096;
const MIN_DETECT_HZ = 50;
const MAX_DETECT_HZ = 5000;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatHz(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '-- Hz';
  return formatSI(value, 'Hz', value >= 100 ? 3 : 2);
}

function drawGrid(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.strokeStyle = 'rgba(71, 85, 105, 0.38)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= CANVAS_WIDTH; x += 92) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_HEIGHT);
    ctx.stroke();
  }
  for (let y = 40; y < CANVAS_HEIGHT; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_WIDTH, y);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
  ctx.beginPath();
  ctx.moveTo(0, CANVAS_HEIGHT / 2);
  ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT / 2);
  ctx.stroke();
}

function drawWaveform(ctx: CanvasRenderingContext2D, data: Float32Array | Uint8Array, color: string) {
  drawGrid(ctx);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();

  for (let i = 0; i < data.length; i += 1) {
    const x = (i / Math.max(1, data.length - 1)) * CANVAS_WIDTH;
    const raw = data instanceof Float32Array ? data[i] : (data[i] - 128) / 128;
    const y = CANVAS_HEIGHT / 2 - raw * (CANVAS_HEIGHT * 0.38);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.stroke();
}

function detectDominantFrequency(analyser: AnalyserNode) {
  const bins = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(bins);

  const sampleRate = analyser.context.sampleRate;
  const binHz = sampleRate / analyser.fftSize;
  const startBin = Math.max(1, Math.floor(MIN_DETECT_HZ / binHz));
  const endBin = Math.min(bins.length - 1, Math.ceil(MAX_DETECT_HZ / binHz));

  let bestBin = startBin;
  let bestValue = 0;
  for (let i = startBin; i <= endBin; i += 1) {
    const value = bins[i];
    if (value > bestValue) {
      bestValue = value;
      bestBin = i;
    }
  }

  if (bestValue < 18) return { frequency: 0, strength: bestValue / 255 };

  const left = bins[bestBin - 1] ?? bestValue;
  const center = bins[bestBin];
  const right = bins[bestBin + 1] ?? bestValue;
  const denominator = left - 2 * center + right;
  const offset = denominator === 0 ? 0 : clamp(0.5 * (left - right) / denominator, -0.5, 0.5);
  return {
    frequency: (bestBin + offset) * binHz,
    strength: bestValue / 255,
  };
}

function makeSyntheticWave(frequencyHz: number, phase: number) {
  const data = new Float32Array(512);
  const cycles = Math.max(0.25, frequencyHz / 90);
  for (let i = 0; i < data.length; i += 1) {
    const x = i / data.length;
    data[i] = Math.sin(TWO_PI * cycles * x + phase);
  }
  return data;
}

export function FrequencyGenerator() {
  const [mode, setMode] = useState<Mode>('tone');
  const [toneHz, setToneHz] = useState(440);
  const [isTonePlaying, setIsTonePlaying] = useState(false);
  const [micStatus, setMicStatus] = useState<MicStatus>('idle');
  const [micError, setMicError] = useState('');
  const [detectedHz, setDetectedHz] = useState(0);
  const [signalStrength, setSignalStrength] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const toneHzRef = useRef(toneHz);
  const modeRef = useRef(mode);
  const isTonePlayingRef = useRef(isTonePlaying);

  const wavelengthM = useMemo(() => (toneHz > 0 ? C_SOUND / toneHz : 0), [toneHz]);

  useEffect(() => {
    toneHzRef.current = toneHz;
    if (oscillatorRef.current) {
      oscillatorRef.current.frequency.setTargetAtTime(toneHz, oscillatorRef.current.context.currentTime, 0.015);
    }
  }, [toneHz]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    isTonePlayingRef.current = isTonePlaying;
  }, [isTonePlaying]);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  const stopTone = useCallback(() => {
    oscillatorRef.current?.stop();
    oscillatorRef.current?.disconnect();
    gainRef.current?.disconnect();
    oscillatorRef.current = null;
    gainRef.current = null;
    setIsTonePlaying(false);
  }, []);

  const stopMic = useCallback(() => {
    micSourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micSourceRef.current = null;
    micStreamRef.current = null;
    analyserRef.current = null;
    setDetectedHz(0);
    setSignalStrength(0);
    setMicStatus('idle');
  }, []);

  const startTone = useCallback(async () => {
    const ctx = getAudioContext();
    await ctx.resume();
    stopTone();

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = toneHzRef.current;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();

    oscillatorRef.current = oscillator;
    gainRef.current = gain;
    setIsTonePlaying(true);
  }, [getAudioContext, stopTone]);

  const startMic = useCallback(async () => {
    stopTone();
    stopMic();
    setMicStatus('requesting');
    setMicError('');

    try {
      const ctx = getAudioContext();
      await ctx.resume();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);

      micStreamRef.current = stream;
      micSourceRef.current = source;
      analyserRef.current = analyser;
      setMicStatus('listening');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not access microphone.';
      setMicError(message);
      setMicStatus('error');
    }
  }, [getAudioContext, stopMic, stopTone]);

  const handleModeChange = (nextMode: Mode) => {
    setMode(nextMode);
    if (nextMode === 'tone') {
      stopMic();
      return;
    }
    stopTone();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const timeData = new Uint8Array(FFT_SIZE);
    let lastUiUpdate = 0;

    const tick = (timestamp: number) => {
      if (modeRef.current === 'mic' && analyserRef.current) {
        analyserRef.current.getByteTimeDomainData(timeData);
        drawWaveform(ctx, timeData, '#22d3ee');

        if (timestamp - lastUiUpdate > 90) {
          lastUiUpdate = timestamp;
          const detected = detectDominantFrequency(analyserRef.current);
          setDetectedHz(detected.frequency);
          setSignalStrength(detected.strength);
        }
      } else {
        const phase = timestamp / 180;
        const toneData = isTonePlayingRef.current
          ? makeSyntheticWave(toneHzRef.current, phase)
          : new Float32Array(512);
        drawWaveform(ctx, toneData, isTonePlayingRef.current ? '#fb7185' : '#64748b');
      }

      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      stopTone();
      stopMic();
      void audioContextRef.current?.close();
    };
  }, [stopMic, stopTone]);

  const displayedFrequency = mode === 'tone' ? toneHz : detectedHz;
  const periodMs = displayedFrequency > 0 ? 1000 / displayedFrequency : 0;

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-400">
            Oscillations and sound
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Frequency Generator
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Generate a pure sine tone or listen through the microphone and detect the strongest
            frequency in real time. The canvas shows the live waveform from the selected source.
          </p>
        </div>
        <Link
          to="/dashboard"
          className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-rose-400 hover:text-rose-100"
        >
          Back to dashboard
        </Link>
      </header>

      <main className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.8fr)]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-rose-300">Live waveform</h2>
              <p className="mt-1 text-xs text-slate-400">
                {mode === 'tone'
                  ? 'Synthetic sine wave from the oscillator frequency'
                  : 'Microphone time-domain samples from an AnalyserNode'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-1">
              <button
                type="button"
                onClick={() => handleModeChange('tone')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  mode === 'tone' ? 'bg-rose-400 text-slate-950' : 'text-slate-300 hover:bg-white/[0.06]'
                }`}
              >
                Tone
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('mic')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  mode === 'mic' ? 'bg-cyan-300 text-slate-950' : 'text-slate-300 hover:bg-white/[0.06]'
                }`}
              >
                Mic
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="block h-auto w-full"
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">
                Frequency
              </p>
              <p className="mt-2 font-mono text-2xl text-rose-100">{formatHz(displayedFrequency)}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">Period</p>
              <p className="mt-2 font-mono text-2xl text-sky-100">
                {periodMs > 0 ? formatTime(periodMs / 1000) : '-- ms'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">
                {mode === 'tone' ? 'Air wavelength' : 'Signal strength'}
              </p>
              <p className="mt-2 font-mono text-2xl text-cyan-100">
                {mode === 'tone' ? formatSI(wavelengthM, 'm', 3) : `${Math.round(signalStrength * 100)}%`}
              </p>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-slate-950/40">
          <h2 className="text-sm font-semibold tracking-wide text-rose-300">Controls</h2>

          {mode === 'tone' ? (
            <>
              <SliderWithInput
                label="Sine tone frequency"
                units="Hz"
                min={0}
                max={5000}
                step={1}
                value={toneHz}
                onChange={setToneHz}
                queryKey="freq"
              />
              <button
                type="button"
                onClick={() => {
                  if (isTonePlaying) {
                    stopTone();
                    return;
                  }
                  void startTone();
                }}
                className="rounded-xl bg-rose-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-rose-300"
              >
                {isTonePlaying ? 'Stop tone' : 'Play tone'}
              </button>
              <p className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs leading-relaxed text-slate-400">
                Browser audio starts only after a user gesture. Keep volume modest, especially
                above 1000 Hz.
              </p>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  if (micStatus === 'listening') {
                    stopMic();
                    return;
                  }
                  void startMic();
                }}
                className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                {micStatus === 'listening' ? 'Stop microphone' : 'Start microphone'}
              </button>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs leading-relaxed text-slate-400">
                <p className="font-semibold text-slate-200">Status: {micStatus}</p>
                <p className="mt-1">
                  FFT size {FFT_SIZE}; detection window {MIN_DETECT_HZ}-{MAX_DETECT_HZ} Hz.
                </p>
                {micError ? <p className="mt-2 text-rose-300">{micError}</p> : null}
              </div>
            </>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <p className="text-xs font-semibold text-slate-200">How detection works</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              The microphone stream goes into an AnalyserNode. The FFT bins estimate which frequency
              band has the largest magnitude, then a tiny parabolic correction refines the peak.
            </p>
          </div>
        </section>
      </main>

      <ConceptBox
        className="mt-6"
        heading="Concept explanation"
        items={[
          {
            title: 'Frequency',
            description:
              'Frequency is cycles per second. A 440 Hz tone completes 440 pressure oscillations every second.',
          },
          {
            title: 'Period',
            description:
              'Period is the time for one cycle, so T = 1 / f. Higher frequency means shorter period.',
          },
          {
            title: 'Sine tone',
            description:
              'The generator mode creates an OscillatorNode with type sine and sends it through a GainNode to the speakers.',
          },
          {
            title: 'Microphone FFT',
            description:
              'The detector mode samples microphone audio with getUserMedia, transforms it with an AnalyserNode, and reports the strongest frequency bin.',
          },
        ]}
      />
    </div>
  );
}
