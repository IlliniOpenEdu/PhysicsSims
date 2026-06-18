import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  wavelengthToRgbCss,
  isVisible,
  wavelengthToFrequency,
  malusTransmittance,
  linear,
  applySnell,
  applyFresnel,
  brewsterAngleRad,
  criticalAngleRad,
  doubleSlitIntensity,
  singleSlitIntensity,
  intensityAtDistance,
  REFRACTIVE_INDEX,
  SPEED_OF_LIGHT,
} from '../../lib/enm/light';
import { SliderWithInput } from '../../components/SliderWithInput';

// ─── Shared helpers ───────────────────────────────────────────────────────────

const DEG = Math.PI / 180;
const colorName = (nm: number) => {
  if (nm < 450) return 'Violet';
  if (nm < 495) return 'Blue';
  if (nm < 570) return 'Green';
  if (nm < 590) return 'Yellow';
  if (nm < 620) return 'Orange';
  return 'Red';
};

// ─── Spectrum bar (full 380-700 nm gradient) ──────────────────────────────────
function SpectrumBar({ markerNm }: { markerNm: number }) {
  const steps = 64;
  const segments = Array.from({ length: steps }, (_, i) => {
    const nm = 380 + (320 * i) / (steps - 1);
    return wavelengthToRgbCss(nm * 1e-9);
  });
  const pct = ((markerNm - 380) / 320) * 100;

  return (
    <div className="relative h-8 w-full overflow-hidden rounded-lg">
      <div
        className="h-full w-full"
        style={{ background: `linear-gradient(to right, ${segments.join(', ')})` }}
      />
      <div
        className="absolute top-0 h-full w-0.5 -translate-x-1/2 bg-white shadow-[0_0_6px_2px_rgba(255,255,255,0.7)]"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}

// ─── Refraction ray diagram ────────────────────────────────────────────────────
function RefractionDiagram({
  theta1Deg, theta2Deg, tir,
  n1Label, n2Label,
}: {
  theta1Deg: number; theta2Deg: number | null; tir: boolean;
  n1Label: string; n2Label: string;
}) {
  const W = 300; const H = 240; const midY = H / 2; const cx = W / 2;
  const len = 90;

  const t1r = theta1Deg * DEG;
  const iEnd = { x: cx - Math.sin(t1r) * len, y: midY - Math.cos(t1r) * len };
  const rEnd = { x: cx + Math.sin(t1r) * len, y: midY - Math.cos(t1r) * len };

  let tEnd: { x: number; y: number } | null = null;
  if (!tir && theta2Deg !== null) {
    const t2r = theta2Deg * DEG;
    tEnd = { x: cx + Math.sin(t2r) * len, y: midY + Math.cos(t2r) * len };
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xs mx-auto" aria-hidden="true">
      {/* Interface */}
      <line x1="0" y1={midY} x2={W} y2={midY} stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="4 4" />
      {/* Normal */}
      <line x1={cx} y1="10" x2={cx} y2={H - 10} stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3 3" />
      {/* Medium labels */}
      <text x="8" y={midY - 10} fill="rgba(148,163,184,0.6)" fontSize="10">{n1Label}</text>
      <text x="8" y={midY + 20} fill="rgba(148,163,184,0.6)" fontSize="10">{n2Label}</text>
      {/* Incident ray */}
      <line x1={iEnd.x} y1={iEnd.y} x2={cx} y2={midY} stroke="#60a5fa" strokeWidth="2" />
      <circle cx={iEnd.x} cy={iEnd.y} r="3" fill="#60a5fa" />
      <text x={iEnd.x - 22} y={iEnd.y - 6} fill="#93c5fd" fontSize="9">Incident</text>
      {/* Reflected ray (dashed) */}
      <line x1={cx} y1={midY} x2={rEnd.x} y2={rEnd.y} stroke="#60a5fa" strokeWidth="1.5" strokeDasharray="5 3" opacity="0.5" />
      <text x={rEnd.x + 4} y={rEnd.y - 6} fill="#93c5fd" fontSize="9" opacity="0.5">Refl.</text>
      {/* Transmitted / TIR */}
      {tEnd && !tir && (
        <>
          <line x1={cx} y1={midY} x2={tEnd.x} y2={tEnd.y} stroke="#34d399" strokeWidth="2" />
          <circle cx={tEnd.x} cy={tEnd.y} r="3" fill="#34d399" />
          <text x={tEnd.x + 4} y={tEnd.y + 14} fill="#6ee7b7" fontSize="9">Refracted</text>
        </>
      )}
      {tir && (
        <text x={cx - 28} y={midY + 30} fill="#f87171" fontSize="10" fontWeight="bold">TIR</text>
      )}
      {/* Angle arcs */}
      {theta1Deg > 2 && (
        <path
          d={`M ${cx} ${midY - 28} A 28 28 0 0 0 ${cx - Math.sin(t1r) * 28} ${midY - Math.cos(t1r) * 28}`}
          fill="none" stroke="#60a5fa" strokeWidth="1" opacity="0.5"
        />
      )}
      <text x={cx - 18} y={midY - 32} fill="#93c5fd" fontSize="8">{theta1Deg.toFixed(0)}°</text>
    </svg>
  );
}

// ─── Interference pattern SVG ──────────────────────────────────────────────────
function InterferencePattern({
  fn, wavelengthM, yRange, N = 200,
}: {
  fn: (y: number) => number; wavelengthM: number; yRange: number; N?: number;
}) {
  const W = 300; const H = 140;
  const color = wavelengthToRgbCss(wavelengthM);

  const bars = Array.from({ length: N }, (_, i) => {
    const y = -yRange + (2 * yRange * i) / (N - 1);
    const I = fn(y);
    const x = (i / (N - 1)) * W;
    return { x, I };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg overflow-hidden" aria-hidden="true">
      <rect width={W} height={H} fill="#030507" />
      {bars.map(({ x, I }, i) => (
        <rect
          key={i}
          x={x}
          y={0}
          width={W / N + 0.5}
          height={H}
          fill={color}
          opacity={I * 0.92 + 0.02}
        />
      ))}
      {/* Center mark */}
      <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke="white" strokeWidth="0.5" opacity="0.15" />
    </svg>
  );
}

// ─── Intensity visualizer ─────────────────────────────────────────────────────
function IntensityRings({ intensity, maxIntensity }: { intensity: number; maxIntensity: number }) {
  const ratio = Math.min(intensity / maxIntensity, 1);
  const visualRatio = Math.max(ratio, 0.06);
  return (
    <svg viewBox="0 0 200 120" className="w-full max-w-xs mx-auto" aria-hidden="true">
      <rect x="18" y="18" width="36" height="84" rx="18" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" />
      <rect x="18" y={102 - visualRatio * 84} width="36" height={visualRatio * 84} rx="18" fill="rgba(250,204,21,0.22)" />
      <text x="24" y="14" fill="rgba(148,163,184,0.7)" fontSize="8">relative</text>
      <text x="24" y="110" fill="rgba(148,163,184,0.7)" fontSize="8">0%</text>
      <text x="22" y="28" fill="rgba(148,163,184,0.7)" fontSize="8">100%</text>
      {[1, 0.6, 0.35, 0.18, 0.08].map((r, i) => (
        <circle
          key={i}
          cx={40}
          cy={60}
          r={6 + i * 14}
          fill="none"
          stroke={`rgba(250,204,21,${Math.max(r * visualRatio * 0.9, 0.06)})`}
          strokeWidth={2}
        />
      ))}
      <circle cx={40} cy={60} r={5} fill={`rgba(250,204,21,${Math.max(ratio, 0.12)})`} />
      <text x={85} y={52} fill="white" fontSize="11" fontWeight="bold">
        {intensity >= 1 ? intensity.toFixed(1) : intensity.toFixed(4)} W/m²
      </text>
      <text x={85} y={68} fill="rgba(148,163,184,0.7)" fontSize="9">at selected distance</text>
    </svg>
  );
}

// ─── Shared card wrapper ──────────────────────────────────────────────────────
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 ${className}`}>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">{children}</p>;
}

function Slider({ label, value, min, max, step = 1, unit = '', onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <SliderWithInput
      label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={onChange}
      units={unit.trim() || undefined}
      syncToUrl={true}
      accentClass="accent-sky-400"
      queryKey={label.toLowerCase().replace(/\s+/g, '-')}
    />
  );
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-semibold text-white">{value}</span>
    </div>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'spectrum',      label: 'Spectrum'      },
  { id: 'polarization',  label: 'Polarization'  },
  { id: 'refraction',    label: 'Refraction'    },
  { id: 'doubleSlit',    label: 'Double-Slit'   },
  { id: 'singleSlit',    label: 'Single-Slit'   },
  { id: 'intensity',     label: 'Intensity'     },
] as const;
type TabId = typeof TABS[number]['id'];

const MEDIA = {
  Air:        { n: REFRACTIVE_INDEX.air,        label: 'Air (n = 1.000)' },
  Water:      { n: REFRACTIVE_INDEX.water,      label: 'Water (n = 1.333)' },
  'Crown Glass': { n: REFRACTIVE_INDEX.glassCrown, label: 'Crown Glass (n = 1.52)' },
  'Flint Glass': { n: REFRACTIVE_INDEX.glassFlint, label: 'Flint Glass (n = 1.62)' },
  Diamond:    { n: REFRACTIVE_INDEX.diamond,    label: 'Diamond (n = 2.417)' },
} as const;
type MediaKey = keyof typeof MEDIA;

// ─── Main page ────────────────────────────────────────────────────────────────
export function Optics() {
  const [tab, setTab] = useState<TabId>('spectrum');

  // Spectrum
  const [wavNm, setWavNm] = useState(550);

  // Polarization
  const [polDeg, setPolDeg] = useState(0);
  const [analyzerDeg, setAnalyzerDeg] = useState(45);

  // Refraction
  const [medium1, setMedium1] = useState<MediaKey>('Air');
  const [medium2, setMedium2] = useState<MediaKey>('Crown Glass');
  const [theta1Deg, setTheta1Deg] = useState(30);

  // Double-slit
  const [dblWavNm, setDblWavNm] = useState(550);
  const [slitSepMm, setSlitSepMm] = useState(0.1);   // mm
  const [screenDistM, setScreenDistM] = useState(1.0);

  // Single-slit
  const [sglWavNm, setSglWavNm] = useState(550);
  const [slitWidthMm, setSlitWidthMm] = useState(0.05);
  const [sglScreenM, setSglScreenM] = useState(1.0);

  // Intensity
  const [powerW, setPowerW] = useState(100);
  const [distM, setDistM] = useState(5);

  // ── Derived: Spectrum ──
  const wavM = wavNm * 1e-9;
  const freq = wavelengthToFrequency(wavM);
  const visible = isVisible(wavM);
  const rgbColor = wavelengthToRgbCss(wavM);

  // ── Derived: Polarization ──
  const polState = linear(polDeg * DEG);
  const transmittance = malusTransmittance(polState, analyzerDeg * DEG);
  const pctIntensity = transmittance * 100;

  // ── Derived: Refraction ──
  const n1 = MEDIA[medium1].n;
  const n2 = MEDIA[medium2].n;
  const { refractedAngleRad, totalInternalReflection } = applySnell({ incidentAngleRad: theta1Deg * DEG, n1, n2 });
  const theta2Deg = refractedAngleRad !== null ? refractedAngleRad / DEG : null;
  const fresnel = applyFresnel({ incidentAngleRad: theta1Deg * DEG, n1, n2 });
  const thetaC = criticalAngleRad(n1, n2);
  const thetaB = brewsterAngleRad(n1, n2);

  // ── Derived: Double-slit ──
  const dblWavM = dblWavNm * 1e-9;
  const slitSepM = slitSepMm * 1e-3;
  const dblParams = useMemo(() => ({ slitSeparationM: slitSepM, screenDistanceM: screenDistM, wavelengthM: dblWavM }), [slitSepM, screenDistM, dblWavM]);
  const fringeSpacingMm = (dblWavM * screenDistM / slitSepM) * 1000;
  const dblRange = fringeSpacingMm * 6 * 1e-3;

  // ── Derived: Single-slit ──
  const sglWavM = sglWavNm * 1e-9;
  const slitWidthM = slitWidthMm * 1e-3;
  const sglParams = useMemo(() => ({ slitWidthM, screenDistanceM: sglScreenM, wavelengthM: sglWavM }), [slitWidthM, sglScreenM, sglWavM]);
  const centralHalfWidth = (sglWavM * sglScreenM / slitWidthM) * 1000;

  // ── Derived: Intensity ──
  const iAtDist = intensityAtDistance(powerW, distM);
  const iAt1m = intensityAtDistance(powerW, 1);

  return (
    <div className="min-h-screen bg-[#030507] text-white">
      <div className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6">

        {/* Header */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className="mb-1 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-sky-400/60">E&M · Optics</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Light &amp; Optics</h1>
          <p className="mt-1.5 text-sm text-slate-500">Wave propagation, polarization, refraction, interference, and intensity — all in one place.</p>
        </motion.div>

        {/* Tab bar */}
        <div className="mb-6 flex flex-wrap gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all duration-150 ${
                tab === t.id ? 'bg-white/[0.09] text-white shadow-sm' : 'text-slate-500 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Panels */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >

            {/* ── SPECTRUM ─────────────────────────────────────────────────── */}
            {tab === 'spectrum' && (
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <Label>Visible Spectrum</Label>
                  <div className="space-y-4">
                    <Slider label="Wavelength" value={wavNm} min={380} max={700} unit=" nm" onChange={setWavNm} />
                    <SpectrumBar markerNm={wavNm} />
                    <div
                      className="mt-2 h-20 w-full rounded-xl border border-white/[0.1] transition-colors duration-200"
                      style={{ backgroundColor: visible ? rgbColor : '#0a0a0a', boxShadow: visible ? `0 0 30px 4px ${rgbColor}55` : 'none' }}
                    />
                    <StatRow label="Color" value={colorName(wavNm)} />
                    <StatRow label="Visible" value={visible ? <span className="text-emerald-400">Yes</span> : <span className="text-red-400">No</span>} />
                    <StatRow label="Frequency" value={`${(freq / 1e14).toFixed(3)} × 10¹⁴ Hz`} />
                    <StatRow label="Period" value={`${(1 / freq * 1e15).toFixed(2)} fs`} />
                    <StatRow label="Energy (eV)" value={`${(SPEED_OF_LIGHT * 6.626e-34 / (wavM * 1.602e-19)).toFixed(3)} eV`} />
                  </div>
                </Card>
                <Card>
                  <Label>About Electromagnetic Light</Label>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    Visible light is electromagnetic radiation with wavelengths between approximately 380 nm (violet) and 700 nm (red).
                    The frequency f = c / λ determines the photon energy E = hf.
                  </p>
                  <div className="rounded-xl bg-white/[0.03] p-3 font-mono text-[0.68rem] text-slate-400 space-y-1">
                    <div>f = c / λ &nbsp;&nbsp; <span className="text-slate-300">frequency (Hz)</span></div>
                    <div>E = hf &nbsp;&nbsp; <span className="text-slate-300">photon energy</span></div>
                    <div>c = 299 792 458 m/s</div>
                    <div>h = 6.626 × 10⁻³⁴ J·s</div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    {[['Violet', '380–450', '#8b5cf6'], ['Green', '495–570', '#34d399'], ['Red', '620–700', '#f87171']].map(([c, r, col]) => (
                      <div key={c} className="rounded-lg p-2" style={{ backgroundColor: `${col}18`, border: `1px solid ${col}40` }}>
                        <div className="text-xs font-semibold" style={{ color: col }}>{c}</div>
                        <div className="text-[0.62rem] text-slate-500 mt-0.5">{r} nm</div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* ── POLARIZATION ─────────────────────────────────────────────── */}
            {tab === 'polarization' && (
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <Label>Malus's Law</Label>
                  <div className="space-y-4">
                    <Slider label="Polarization angle" value={polDeg} min={0} max={180} unit="°" onChange={setPolDeg} />
                    <Slider label="Analyzer angle" value={analyzerDeg} min={0} max={180} unit="°" onChange={setAnalyzerDeg} />

                    {/* Intensity bar */}
                    <div className="mt-2">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-slate-400">Transmitted intensity</span>
                        <span className="font-bold text-white">{pctIntensity.toFixed(1)}%</span>
                      </div>
                      <div className="h-5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                          animate={{ width: `${pctIntensity}%` }}
                          transition={{ duration: 0.15 }}
                        />
                      </div>
                    </div>

                    {/* Visual polarizer */}
                    <div className="flex items-center justify-center gap-6 py-2">
                      {[{ label: 'Polarizer', angle: polDeg, color: '#60a5fa' }, { label: 'Analyzer', angle: analyzerDeg, color: '#34d399' }].map(({ label, angle, color }) => (
                        <div key={label} className="flex flex-col items-center gap-1">
                          <svg viewBox="0 0 50 50" className="h-12 w-12" aria-hidden="true">
                            <circle cx="25" cy="25" r="22" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
                            {Array.from({ length: 8 }, (_, i) => {
                              const a = (angle + i * 22.5) * DEG;
                              return <line key={i} x1={25 - Math.cos(a) * 20} y1={25 - Math.sin(a) * 20} x2={25 + Math.cos(a) * 20} y2={25 + Math.sin(a) * 20} stroke={color} strokeWidth="1.2" opacity={i === 0 ? 1 : 0.15} />;
                            })}
                          </svg>
                          <span className="text-[0.6rem] text-slate-500">{label}</span>
                          <span className="text-[0.6rem] font-semibold" style={{ color }}>{angle}°</span>
                        </div>
                      ))}
                    </div>

                    <StatRow label="Δθ (analyzer − polarizer)" value={`${analyzerDeg - polDeg}°`} />
                    <StatRow label="cos²(Δθ)" value={transmittance.toFixed(4)} />
                  </div>
                </Card>
                <Card>
                  <Label>About Polarization</Label>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">
                    Light is a transverse wave. When it passes through a linear polarizer, only the component aligned with the polarizer's axis is transmitted.
                    Malus's Law describes how intensity changes with a second polarizer (analyzer).
                  </p>
                  <div className="rounded-xl bg-white/[0.03] p-3 font-mono text-[0.7rem] text-slate-300 space-y-1">
                    <div>I = I₀ · cos²(Δθ)</div>
                    <div className="text-slate-500 text-[0.62rem]">Δθ = angle between polarizer and analyzer</div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {[['Parallel (Δθ = 0°)', '100% transmitted'], ['45°', '50% transmitted'], ['Crossed (Δθ = 90°)', '0% transmitted']].map(([c, d]) => (
                      <div key={c} className="flex justify-between text-xs">
                        <span className="text-slate-400">{c}</span>
                        <span className="text-slate-300">{d}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* ── REFRACTION ────────────────────────────────────────────────── */}
            {tab === 'refraction' && (
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <Label>Snell's Law &amp; Fresnel</Label>
                  <div className="space-y-4">
                    <div>
                      <div className="mb-1 text-xs text-slate-400">Medium 1 (incident)</div>
                      <select
                        value={medium1}
                        onChange={(e) => setMedium1(e.target.value as MediaKey)}
                        className="w-full appearance-none rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-xs text-slate-200 outline-none"
                      >
                        {(Object.keys(MEDIA) as MediaKey[]).map((k) => (
                          <option
                            key={k}
                            value={k}
                            className="bg-slate-950 text-slate-200"
                          >
                            {MEDIA[k].label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="mb-1 text-xs text-slate-400">Medium 2 (transmitted)</div>
                      <select
                        value={medium2}
                        onChange={(e) => setMedium2(e.target.value as MediaKey)}
                        className="w-full appearance-none rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-xs text-slate-200 outline-none"
                      >
                        {(Object.keys(MEDIA) as MediaKey[]).map((k) => (
                          <option
                            key={k}
                            value={k}
                            className="bg-slate-950 text-slate-200"
                          >
                            {MEDIA[k].label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Slider label="Incident angle θ₁" value={theta1Deg} min={0} max={89} unit="°" onChange={setTheta1Deg} />

                    <RefractionDiagram
                      theta1Deg={theta1Deg}
                      theta2Deg={theta2Deg}
                      tir={totalInternalReflection}
                      n1Label={medium1}
                      n2Label={medium2}
                    />
                  </div>
                </Card>
                <Card>
                  <Label>Results</Label>
                  <div className="space-y-0">
                    <StatRow label="n₁" value={n1.toFixed(4)} />
                    <StatRow label="n₂" value={n2.toFixed(4)} />
                    <StatRow label="θ₁ (incident)" value={`${theta1Deg}°`} />
                    <StatRow label="θ₂ (refracted)" value={totalInternalReflection ? <span className="text-red-400">TIR</span> : `${theta2Deg?.toFixed(2)}°`} />
                    <StatRow label="Critical angle" value={thetaC !== null ? `${(thetaC / DEG).toFixed(2)}°` : <span className="text-slate-600">n/a (n₁ ≤ n₂)</span>} />
                    <StatRow label="Brewster angle" value={`${(thetaB / DEG).toFixed(2)}°`} />
                  </div>
                  <div className="mt-4">
                    <Label>Fresnel Power Coefficients</Label>
                    {[
                      { label: 'Rs (s-pol reflected)', val: fresnel.Rs, color: '#60a5fa' },
                      { label: 'Rp (p-pol reflected)', val: fresnel.Rp, color: '#818cf8' },
                      { label: 'Ts (s-pol transmitted)', val: fresnel.Ts, color: '#34d399' },
                      { label: 'Tp (p-pol transmitted)', val: fresnel.Tp, color: '#6ee7b7' },
                    ].map(({ label, val, color }) => (
                      <div key={label} className="mb-1.5">
                        <div className="flex justify-between text-[0.65rem] mb-0.5">
                          <span className="text-slate-500">{label}</span>
                          <span style={{ color }} className="font-semibold">{(val * 100).toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/[0.06]">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: color }}
                            animate={{ width: `${val * 100}%` }}
                            transition={{ duration: 0.15 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  {totalInternalReflection && (
                    <div className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-300">
                      Total internal reflection — all light is reflected back into medium 1.
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* ── DOUBLE-SLIT ───────────────────────────────────────────────── */}
            {tab === 'doubleSlit' && (
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <Label>Controls</Label>
                  <div className="space-y-4">
                    <Slider label="Wavelength" value={dblWavNm} min={380} max={700} unit=" nm" onChange={setDblWavNm} />
                    <Slider label="Slit separation d" value={slitSepMm} min={0.05} max={1.0} step={0.01} unit=" mm" onChange={setSlitSepMm} />
                    <Slider label="Screen distance L" value={screenDistM} min={0.1} max={5} step={0.1} unit=" m" onChange={setScreenDistM} />
                    <div className="mt-2">
                      <Label>Fringe pattern on screen</Label>
                      <InterferencePattern
                        fn={(y) => doubleSlitIntensity(y, dblParams)}
                        wavelengthM={dblWavM}
                        yRange={dblRange}
                      />
                      <p className="mt-1 text-center text-[0.62rem] text-slate-600">← screen (±{(dblRange * 1000).toFixed(1)} mm) →</p>
                    </div>
                  </div>
                </Card>
                <Card>
                  <Label>Results</Label>
                  <div className="space-y-0">
                    <StatRow label="Wavelength" value={`${dblWavNm} nm`} />
                    <StatRow label="Slit separation d" value={`${slitSepMm} mm`} />
                    <StatRow label="Screen distance L" value={`${screenDistM} m`} />
                    <StatRow label="Fringe spacing Δy = λL/d" value={`${fringeSpacingMm.toFixed(3)} mm`} />
                    <StatRow label="Color" value={colorName(dblWavNm)} />
                  </div>
                  <div className="mt-4 rounded-xl bg-white/[0.03] p-3 font-mono text-[0.68rem] text-slate-400 space-y-1">
                    <div>I(y) = cos²(π d y / λL)</div>
                    <div className="text-slate-600">Bright: y_m = m λL/d</div>
                    <div className="text-slate-600">Dark: y = (m+½) λL/d</div>
                  </div>
                  <p className="mt-3 text-[0.68rem] text-slate-500 leading-relaxed">
                    Smaller slit separation → wider fringes. Longer wavelength → wider fringes. Closer screen → narrower fringes.
                  </p>
                </Card>
              </div>
            )}

            {/* ── SINGLE-SLIT ───────────────────────────────────────────────── */}
            {tab === 'singleSlit' && (
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <Label>Controls</Label>
                  <div className="space-y-4">
                    <Slider label="Wavelength" value={sglWavNm} min={380} max={700} unit=" nm" onChange={setSglWavNm} />
                    <Slider label="Slit width a" value={slitWidthMm} min={0.01} max={0.5} step={0.005} unit=" mm" onChange={setSlitWidthMm} />
                    <Slider label="Screen distance L" value={sglScreenM} min={0.1} max={5} step={0.1} unit=" m" onChange={setSglScreenM} />
                    <div className="mt-2">
                      <Label>Diffraction pattern on screen</Label>
                      <InterferencePattern
                        fn={(y) => singleSlitIntensity(y, sglParams)}
                        wavelengthM={sglWavM}
                        yRange={centralHalfWidth * 3 * 1e-3}
                      />
                      <p className="mt-1 text-center text-[0.62rem] text-slate-600">← screen →</p>
                    </div>
                  </div>
                </Card>
                <Card>
                  <Label>Results</Label>
                  <div className="space-y-0">
                    <StatRow label="Wavelength" value={`${sglWavNm} nm`} />
                    <StatRow label="Slit width a" value={`${slitWidthMm} mm`} />
                    <StatRow label="Screen distance L" value={`${sglScreenM} m`} />
                    <StatRow label="Central max half-width" value={`${centralHalfWidth.toFixed(2)} mm`} />
                    <StatRow label="1st minimum at y = λL/a" value={`± ${centralHalfWidth.toFixed(2)} mm`} />
                  </div>
                  <div className="mt-4 rounded-xl bg-white/[0.03] p-3 font-mono text-[0.68rem] text-slate-400 space-y-1">
                    <div>I(y) = sinc²(π a y / λL)</div>
                    <div className="text-slate-600">sinc(x) = sin(x)/x</div>
                    <div className="text-slate-600">Minima: y_m = m λL/a</div>
                  </div>
                  <p className="mt-3 text-[0.68rem] text-slate-500 leading-relaxed">
                    Narrower slit → wider central maximum. Single-slit diffraction modulates the double-slit fringe pattern envelope.
                  </p>
                </Card>
              </div>
            )}

            {/* ── INTENSITY ─────────────────────────────────────────────────── */}
            {tab === 'intensity' && (
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <Label>Controls</Label>
                  <div className="space-y-4">
                    <Slider label="Source power P" value={powerW} min={1} max={10000} step={1} unit=" W" onChange={setPowerW} />
                    <Slider label="Distance r" value={distM} min={0.1} max={100} step={0.1} unit=" m" onChange={setDistM} />
                    <div className="mt-2">
                      <Label>Intensity visualization</Label>
                      <IntensityRings intensity={iAtDist} maxIntensity={iAt1m} />
                    </div>
                  </div>
                </Card>
                <Card>
                  <Label>Results</Label>
                  <div className="space-y-0">
                    <StatRow label="Source power P" value={`${powerW} W`} />
                    <StatRow label="Distance r" value={`${distM} m`} />
                    <StatRow label="Intensity I = P / 4πr²" value={
                      iAtDist >= 1 ? `${iAtDist.toFixed(2)} W/m²` : `${iAtDist.toExponential(3)} W/m²`
                    } />
                    <StatRow label="at 1 m" value={`${iAt1m.toFixed(2)} W/m²`} />
                    <StatRow label="Ratio I(r) / I(1m)" value={`1 / ${(iAt1m / iAtDist).toFixed(1)}`} />
                  </div>
                  <div className="mt-4 rounded-xl bg-white/[0.03] p-3 font-mono text-[0.68rem] text-slate-400 space-y-1">
                    <div>I = P / (4π r²)</div>
                    <div className="text-slate-600">Isotropic point source</div>
                    <div className="text-slate-600">Double r → quarter I</div>
                  </div>
                  <p className="mt-3 text-[0.68rem] text-slate-500 leading-relaxed">
                    The inverse square law — intensity falls off as the square of distance because power spreads over a growing spherical surface (area = 4πr²).
                  </p>
                </Card>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}