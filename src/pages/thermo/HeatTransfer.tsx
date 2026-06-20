import { useMemo, useState } from 'react';
import { ConceptBox } from '../../components/ConceptBox';
import { SliderWithInput } from '../../components/SliderWithInput';

type Mode = 'conduction' | 'convection' | 'radiation';
type MaterialKey = 'copper' | 'steel' | 'wood' | 'air';
type ConvectionKind = 'natural' | 'forced';

const SIGMA = 5.670374419e-8;

const MATERIALS: Record<MaterialKey, { name: string; k: number; diffusivity: number; note: string }> = {
  copper: {
    name: 'Copper',
    k: 401,
    diffusivity: 1.11e-4,
    note: 'High k: heat spreads quickly, like a pan bottom.',
  },
  steel: {
    name: 'Steel',
    k: 45,
    diffusivity: 1.2e-5,
    note: 'Moderate k: useful when strength matters too.',
  },
  wood: {
    name: 'Wood',
    k: 0.12,
    diffusivity: 1.5e-7,
    note: 'Low k: heat moves slowly, so handles stay cooler.',
  },
  air: {
    name: 'Air',
    k: 0.026,
    diffusivity: 2.2e-5,
    note: 'Very low k: still air is an excellent insulator.',
  },
};

const MODES: { id: Mode; label: string; summary: string }[] = [
  { id: 'conduction', label: 'Conduction', summary: 'Heat through a solid bar' },
  { id: 'convection', label: 'Convection', summary: 'Heat carried by moving fluid' },
  { id: 'radiation', label: 'Radiation', summary: 'Heat emitted as light' },
];

const formatNumber = (value: number, digits = 2) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);

const formatWatts = (value: number) => {
  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000) return `${formatNumber(value / 1_000_000, 2)} MW`;
  if (magnitude >= 1_000) return `${formatNumber(value / 1_000, 2)} kW`;
  if (magnitude < 1) return `${formatNumber(value, 3)} W`;
  return `${formatNumber(value, 1)} W`;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const tempToColor = (tempC: number) => {
  const t = clamp((tempC + 20) / 340, 0, 1);
  const hue = 220 - 220 * t;
  const saturation = 88;
  const lightness = 38 + 22 * t;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
};

const blackbodyColor = (tempK: number) => {
  if (tempK < 525) return '#050505';
  if (tempK < 900) return '#4c0b05';
  if (tempK < 1300) return '#b92d12';
  if (tempK < 1800) return '#ff7a18';
  if (tempK < 2300) return '#ffd184';
  return '#fff6df';
};

function ControlSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-slate-950/45 p-3">
      <SliderWithInput
        label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        units={unit || undefined}
        syncToUrl={false}
        inputClassName="w-20 rounded-md border border-white/10 bg-slate-950 px-2 py-1 text-right text-xs text-slate-100 outline-none focus:border-cyan-300"
      />
    </div>
  );
}

function ModeButton({
  mode,
  activeMode,
  onSelect,
}: {
  mode: { id: Mode; label: string; summary: string };
  activeMode: Mode;
  onSelect: (mode: Mode) => void;
}) {
  const active = mode.id === activeMode;
  return (
    <button
      type="button"
      onClick={() => onSelect(mode.id)}
      className={`rounded-xl border px-4 py-3 text-left transition ${
        active
          ? 'border-cyan-300/60 bg-cyan-300/10 text-cyan-100 shadow-lg shadow-cyan-950/30'
          : 'border-white/[0.07] bg-white/[0.025] text-slate-400 hover:border-white/15 hover:text-slate-100'
      }`}
    >
      <span className="block text-sm font-semibold">{mode.label}</span>
      <span className="mt-1 block text-xs">{mode.summary}</span>
    </button>
  );
}

function ReadoutCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-slate-950/55 p-4">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{detail}</p>
    </div>
  );
}

function LawBox({ title, formula, plugged }: { title: string; formula: string; plugged: string }) {
  return (
    <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/80">{title}</p>
      <p className="mt-3 font-mono text-sm text-cyan-50">{formula}</p>
      <p className="mt-2 font-mono text-xs leading-relaxed text-cyan-100/70">{plugged}</p>
    </div>
  );
}

function ConvectionVisual({ kind, heatSourceTemp }: { kind: ConvectionKind; heatSourceTemp: number }) {
  const particles = Array.from({ length: 18 }, (_, index) => {
    const left = 10 + ((index * 19) % 78);
    const delay = -(index % 9) * 0.45;
    const duration = kind === 'forced' ? 2.2 + (index % 3) * 0.2 : 3.7 + (index % 4) * 0.25;
    const size = 6 + (index % 4) * 2;
    return { delay, duration, left, size };
  });

  return (
    <div className="relative h-[25rem] overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-sky-950 via-slate-950 to-orange-950/70">
      <div className="absolute inset-x-8 top-8 h-28 rounded-full bg-cyan-300/10 blur-3xl" />
      <div className="absolute inset-x-10 bottom-8 h-12 rounded-full bg-orange-400/25 blur-2xl" />
      <div className="absolute bottom-0 left-1/2 h-5 w-52 -translate-x-1/2 rounded-t-full bg-gradient-to-r from-orange-900 via-orange-400 to-yellow-200 shadow-[0_0_45px_rgba(251,146,60,0.55)]" />
      <div className="absolute left-6 right-6 top-10 h-72 rounded-[2rem] border border-cyan-200/10 bg-white/[0.025]" />

      {particles.map((particle) => (
        <span
          key={`${particle.left}-${particle.delay}`}
          className={`absolute bottom-12 rounded-full bg-cyan-200/70 shadow-[0_0_18px_rgba(125,211,252,0.55)] ${
            kind === 'forced' ? 'animate-[driftForced_linear_infinite]' : 'animate-[riseLoop_linear_infinite]'
          }`}
          style={{
            left: `${particle.left}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
          }}
        />
      ))}

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 420 400" aria-hidden="true">
        <path
          d="M120 335 C55 265 75 120 175 95 C250 75 320 130 300 210 C286 270 212 265 205 205"
          fill="none"
          stroke="rgba(125,211,252,0.5)"
          strokeWidth="3"
          strokeDasharray="10 12"
          className="animate-[dashFlow_2.2s_linear_infinite]"
        />
        <path
          d="M285 335 C360 250 330 110 240 92 C158 76 95 140 120 220 C138 275 215 262 214 194"
          fill="none"
          stroke="rgba(251,146,60,0.5)"
          strokeWidth="3"
          strokeDasharray="10 12"
          className="animate-[dashFlow_2.2s_linear_infinite]"
        />
        {kind === 'forced' ? (
          <path
            d="M40 205 H380"
            fill="none"
            stroke="rgba(226,232,240,0.5)"
            strokeWidth="4"
            strokeDasharray="14 14"
            className="animate-[dashFlow_1.1s_linear_infinite]"
          />
        ) : null}
      </svg>

      <div className="absolute left-5 top-5 rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs text-slate-300">
        {kind === 'forced' ? 'Fan-driven flow' : 'Buoyancy-driven flow'}
      </div>
      <div className="absolute bottom-6 right-6 rounded-xl border border-orange-300/20 bg-orange-300/10 px-3 py-2 text-xs text-orange-100">
        Source: {formatNumber(heatSourceTemp, 0)} C
      </div>
    </div>
  );
}

export function HeatTransfer() {
  const [mode, setMode] = useState<Mode>('conduction');
  const [materialKey, setMaterialKey] = useState<MaterialKey>('copper');
  const [hotTemp, setHotTemp] = useState(180);
  const [coldTemp, setColdTemp] = useState(25);
  const [area, setArea] = useState(0.035);
  const [length, setLength] = useState(0.75);
  const [convectionKind, setConvectionKind] = useState<ConvectionKind>('natural');
  const [fluidArea, setFluidArea] = useState(0.45);
  const [heatSourceTemp, setHeatSourceTemp] = useState(90);
  const [ambientTemp, setAmbientTemp] = useState(22);
  const [radiationTemp, setRadiationTemp] = useState(950);
  const [emissivity, setEmissivity] = useState(0.85);
  const [radiationArea, setRadiationArea] = useState(0.2);

  const material = MATERIALS[materialKey];
  const deltaT = hotTemp - coldTemp;
  const conductionRate = (material.k * area * Math.abs(deltaT)) / length;
  const conductionFlux = conductionRate / area;
  const conductionTime = length ** 2 / (Math.PI ** 2 * material.diffusivity);
  const gradientStops = useMemo(() => {
    const steps = Array.from({ length: 9 }, (_, index) => {
      const pct = index / 8;
      const temp = hotTemp + (coldTemp - hotTemp) * pct;
      return `${tempToColor(temp)} ${pct * 100}%`;
    });
    return `linear-gradient(90deg, ${steps.join(', ')})`;
  }, [coldTemp, hotTemp]);

  const h = convectionKind === 'forced' ? 55 : 8;
  const convectionDelta = heatSourceTemp - ambientTemp;
  const convectionRate = h * fluidArea * Math.abs(convectionDelta);
  const convectionFlux = convectionRate / fluidArea;
  const convectionTime = 5000 / (h * fluidArea);

  const ambientK = ambientTemp + 273.15;
  const radiationRate = emissivity * SIGMA * radiationArea * Math.max(0, radiationTemp ** 4 - ambientK ** 4);
  const radiationFlux = radiationRate / radiationArea;
  const radiationTime = 5000 / Math.max(0.001, 4 * emissivity * SIGMA * radiationArea * radiationTemp ** 3);
  const peakMicrometers = 2898 / radiationTemp;
  const objectColor = blackbodyColor(radiationTemp);
  const activeRate = mode === 'conduction' ? conductionRate : mode === 'convection' ? convectionRate : radiationRate;
  const activeFlux = mode === 'conduction' ? conductionFlux : mode === 'convection' ? convectionFlux : radiationFlux;
  const activeTime = mode === 'conduction' ? conductionTime : mode === 'convection' ? convectionTime : radiationTime;

  return (
    <div className="min-h-screen bg-[#030507] px-4 py-10 text-slate-100">
      <style>
        {`
          @keyframes riseLoop {
            0% { transform: translate3d(0, 0, 0) scale(0.75); opacity: 0; }
            15% { opacity: 0.85; }
            55% { transform: translate3d(34px, -150px, 0) scale(1); }
            100% { transform: translate3d(-18px, -285px, 0) scale(0.55); opacity: 0; }
          }
          @keyframes driftForced {
            0% { transform: translate3d(-120px, -120px, 0) scale(0.75); opacity: 0; }
            15% { opacity: 0.85; }
            100% { transform: translate3d(235px, -120px, 0) scale(0.9); opacity: 0; }
          }
          @keyframes dashFlow {
            to { stroke-dashoffset: -44; }
          }
        `}
      </style>

      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-300/70">
            Thermodynamics Lab
          </p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Heat Transfer</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                Compare conduction, convection, and radiation in one place. The bar is the anchor:
                change the material and see why copper moves heat while wood protects your hand.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-2">
              {MODES.map((item) => (
                <ModeButton key={item.id} mode={item} activeMode={mode} onSelect={setMode} />
              ))}
            </div>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.5fr_0.9fr]">
          <div className="rounded-3xl border border-white/[0.08] bg-slate-900/55 p-5 shadow-2xl shadow-slate-950/40">
            {mode === 'conduction' ? (
              <div>
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Conduction Bar</h2>
                    <p className="mt-1 text-sm text-slate-400">Thermal reservoirs clamp each end of the bar.</p>
                  </div>
                  <div className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-xs text-violet-100">
                    {material.name}: k = {material.k} W/m*K
                  </div>
                </div>

                <div className="relative rounded-[2rem] border border-white/[0.08] bg-slate-950/70 p-6">
                  <div className="grid gap-4 md:grid-cols-[7rem_1fr_7rem] md:items-center">
                    <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-center">
                      <p className="text-xs uppercase tracking-[0.2em] text-red-200/70">Hot</p>
                      <p className="mt-2 text-2xl font-semibold text-red-100">{formatNumber(hotTemp, 0)} C</p>
                    </div>
                    <div className="relative h-32 rounded-2xl border border-white/10 bg-slate-900 p-4">
                      <div
                        className="h-full rounded-xl shadow-[inset_0_0_35px_rgba(255,255,255,0.18)]"
                        style={{ background: gradientStops }}
                      />
                      <div className="absolute inset-x-8 top-1/2 h-px -translate-y-1/2 bg-white/35" />
                      <div className="absolute left-8 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,0.8)]" />
                      <div className="absolute right-8 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white/80" />
                    </div>
                    <div className="rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4 text-center">
                      <p className="text-xs uppercase tracking-[0.2em] text-sky-200/70">Cold</p>
                      <p className="mt-2 text-2xl font-semibold text-sky-100">{formatNumber(coldTemp, 0)} C</p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 text-xs text-slate-400 md:grid-cols-3">
                    <p>{material.note}</p>
                    <p>Temperature drop: {formatNumber(Math.abs(deltaT), 0)} C across {formatNumber(length, 2)} m.</p>
                    <p>Higher k means the same gradient carries more heat per second.</p>
                  </div>
                </div>
              </div>
            ) : null}

            {mode === 'convection' ? (
              <div>
                <div className="mb-5">
                  <h2 className="text-xl font-semibold text-white">Convection Cell</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Warm fluid rises, cool fluid sinks, and moving fluid transports thermal energy.
                  </p>
                </div>
                <ConvectionVisual kind={convectionKind} heatSourceTemp={heatSourceTemp} />
              </div>
            ) : null}

            {mode === 'radiation' ? (
              <div>
                <div className="mb-5">
                  <h2 className="text-xl font-semibold text-white">Thermal Radiation</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Raise temperature and watch the object brighten as emitted power scales with T^4.
                  </p>
                </div>
                <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="relative grid min-h-[25rem] place-items-center overflow-hidden rounded-3xl border border-white/[0.08] bg-black">
                    <div
                      className="h-44 w-44 rounded-full border border-white/10 transition-colors duration-200"
                      style={{
                        backgroundColor: objectColor,
                        boxShadow: `0 0 ${Math.round(radiationTemp / 16)}px ${objectColor}`,
                      }}
                    />
                    <div className="absolute bottom-6 rounded-full border border-white/10 bg-slate-950/75 px-4 py-2 text-sm text-slate-200">
                      {formatNumber(radiationTemp, 0)} K
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/[0.08] bg-slate-950/55 p-5">
                    <p className="text-sm font-semibold text-white">Emission Spectrum</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Wien peak: λmax = {formatNumber(peakMicrometers, 2)} micrometers
                    </p>
                    <svg className="mt-5 h-56 w-full" viewBox="0 0 520 240" role="img" aria-label="Emission spectrum curve">
                      <defs>
                        <linearGradient id="spectrumGradient" x1="0" x2="1">
                          <stop offset="0%" stopColor="#6d28d9" />
                          <stop offset="18%" stopColor="#2563eb" />
                          <stop offset="35%" stopColor="#22c55e" />
                          <stop offset="54%" stopColor="#facc15" />
                          <stop offset="72%" stopColor="#f97316" />
                          <stop offset="100%" stopColor="#dc2626" />
                        </linearGradient>
                      </defs>
                      <rect x="40" y="22" width="440" height="176" rx="18" fill="rgba(15,23,42,0.8)" />
                      <rect x="70" y="175" width="380" height="12" rx="6" fill="url(#spectrumGradient)" opacity="0.85" />
                      <path
                        d={`M70 180 C ${130 + radiationTemp / 22} ${190 - radiationTemp / 18}, ${190 + radiationTemp / 9} ${210 - radiationTemp / 13}, 450 82`}
                        fill="none"
                        stroke={objectColor}
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                      <line
                        x1={clamp(450 - peakMicrometers * 70, 80, 445)}
                        x2={clamp(450 - peakMicrometers * 70, 80, 445)}
                        y1="40"
                        y2="190"
                        stroke="rgba(255,255,255,0.55)"
                        strokeDasharray="6 8"
                      />
                      <text x="70" y="218" fill="rgba(203,213,225,0.72)" fontSize="13">short wavelength</text>
                      <text x="338" y="218" fill="rgba(203,213,225,0.72)" fontSize="13">long wavelength</text>
                    </svg>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <aside className="space-y-5">
            <div className="rounded-3xl border border-white/[0.08] bg-slate-900/55 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Controls</h2>

              {mode === 'conduction' ? (
                <div className="mt-4 space-y-3">
                  <label className="block rounded-xl border border-white/[0.06] bg-slate-950/45 p-3 text-xs text-slate-300">
                    Material
                    <select
                      value={materialKey}
                      onChange={(event) => setMaterialKey(event.currentTarget.value as MaterialKey)}
                      className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                    >
                      {Object.entries(MATERIALS).map(([key, item]) => (
                        <option key={key} value={key}>
                          {item.name} - k {item.k}
                        </option>
                      ))}
                    </select>
                  </label>
                  <ControlSlider label="Hot reservoir" value={hotTemp} min={30} max={300} step={1} unit="C" onChange={setHotTemp} />
                  <ControlSlider label="Cold reservoir" value={coldTemp} min={-20} max={150} step={1} unit="C" onChange={setColdTemp} />
                  <ControlSlider label="Area" value={area} min={0.005} max={0.12} step={0.005} unit="m2" onChange={setArea} />
                  <ControlSlider label="Length" value={length} min={0.1} max={2} step={0.05} unit="m" onChange={setLength} />
                </div>
              ) : null}

              {mode === 'convection' ? (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/[0.06] bg-slate-950/45 p-2">
                    {(['natural', 'forced'] as ConvectionKind[]).map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => setConvectionKind(kind)}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize transition ${
                          convectionKind === kind ? 'bg-cyan-300 text-slate-950' : 'text-slate-400 hover:bg-white/[0.06]'
                        }`}
                      >
                        {kind}
                      </button>
                    ))}
                  </div>
                  <ControlSlider label="Heat source" value={heatSourceTemp} min={30} max={180} step={1} unit="C" onChange={setHeatSourceTemp} />
                  <ControlSlider label="Ambient fluid" value={ambientTemp} min={0} max={60} step={1} unit="C" onChange={setAmbientTemp} />
                  <ControlSlider label="Surface area" value={fluidArea} min={0.05} max={1.2} step={0.05} unit="m2" onChange={setFluidArea} />
                </div>
              ) : null}

              {mode === 'radiation' ? (
                <div className="mt-4 space-y-3">
                  <ControlSlider label="Object temperature" value={radiationTemp} min={250} max={2800} step={10} unit="K" onChange={setRadiationTemp} />
                  <ControlSlider label="Emissivity" value={emissivity} min={0.05} max={1} step={0.01} unit="" onChange={setEmissivity} />
                  <ControlSlider label="Area" value={radiationArea} min={0.02} max={1} step={0.02} unit="m2" onChange={setRadiationArea} />
                  <ControlSlider label="Room temperature" value={ambientTemp} min={0} max={60} step={1} unit="C" onChange={setAmbientTemp} />
                </div>
              ) : null}
            </div>

            <div className="grid gap-3">
              <ReadoutCard label="Heat flux Q/t" value={formatWatts(activeRate)} detail={`${formatNumber(activeFlux, 1)} W/m2 through the active surface.`} />
              <ReadoutCard label="Equilibrium time estimate" value={`${formatNumber(activeTime, 1)} s`} detail="A first-order estimate, useful for comparing settings rather than predicting every detail." />
            </div>

            {mode === 'conduction' ? (
              <LawBox
                title="Fourier's Law"
                formula="Q/t = k A (Delta T / L)"
                plugged={`${formatWatts(conductionRate)} = ${material.k} * ${formatNumber(area, 3)} * (${formatNumber(Math.abs(deltaT), 0)} / ${formatNumber(length, 2)})`}
              />
            ) : null}
            {mode === 'convection' ? (
              <LawBox
                title="Newton's Law of Cooling"
                formula="Q/t = h A (Ts - Tinf)"
                plugged={`${formatWatts(convectionRate)} = ${h} * ${formatNumber(fluidArea, 2)} * (${formatNumber(Math.abs(convectionDelta), 0)})`}
              />
            ) : null}
            {mode === 'radiation' ? (
              <LawBox
                title="Stefan-Boltzmann Law"
                formula="P = epsilon sigma A (T^4 - Troom^4)"
                plugged={`${formatWatts(radiationRate)} = ${formatNumber(emissivity, 2)} * sigma * ${formatNumber(radiationArea, 2)} * (${formatNumber(radiationTemp, 0)}^4 - ${formatNumber(ambientK, 0)}^4)`}
              />
            ) : null}
          </aside>
        </section>

        <ConceptBox
          className="mt-6"
          heading="What to notice"
          items={[
            {
              title: 'Conduction depends on material',
              description:
                'The same temperature difference produces a much larger heat rate in copper than in wood because thermal conductivity k is much larger.',
            },
            {
              title: 'Convection needs motion',
              description:
                'Natural convection comes from buoyancy. Forced convection adds a fan or pump, raising h and carrying heat away faster.',
            },
            {
              title: 'Radiation grows brutally fast',
              description:
                'Radiated power scales with absolute temperature to the fourth power, so a modest temperature increase can strongly brighten the emitter.',
            },
            {
              title: 'Geometry matters',
              description:
                'Area increases heat transfer. For conduction, length resists heat flow because the temperature drop is spread over more distance.',
            },
          ]}
        />
      </div>
    </div>
  );
}
