import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConceptBox } from '../../components/ConceptBox';
import { SliderWithInput } from '../../components/SliderWithInput';
import { MagFieldScene } from '../../components/magField3d';
import {
  forcePerLength,
  loopCentreField,
  solenoidField,
  wireFieldMagnitude,
} from '../../lib/enm/magField3d/field';
import type { FieldDensity, MagFieldParams, MagMode } from '../../lib/enm/magField3d/types';
import { formatAuto } from '../../utils/formatters';

const MODES: { id: MagMode; label: string; summary: string }[] = [
  { id: 'wire', label: 'Straight Wire', summary: 'Concentric circulating field' },
  { id: 'solenoid', label: 'Solenoid', summary: 'Uniform inside, bar-magnet outside' },
  { id: 'loop', label: 'Current Loop', summary: 'Dipole field pattern' },
  { id: 'two-wire', label: 'Two Wires', summary: 'Attraction vs repulsion' },
];

const DENSITIES: FieldDensity[] = ['low', 'medium', 'high'];

const DEFAULT_PARAMS: MagFieldParams = {
  mode: 'wire',
  current: 20,
  direction: 1,
  turns: 16,
  coilRadiusCm: 20,
  coilLengthCm: 60,
  density: 'medium',
  separationCm: 4,
  oppositeCurrent: false,
  showCompass: false,
  compass: { x: 2.4, y: 0, z: 0 },
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
  mode: { id: MagMode; label: string; summary: string };
  activeMode: MagMode;
  onSelect: (mode: MagMode) => void;
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

export function MagField3D() {
  const [params, setParams] = useState<MagFieldParams>(DEFAULT_PARAMS);
  const [animate, setAnimate] = useState(true);

  const patch = (next: Partial<MagFieldParams>) => setParams((prev) => ({ ...prev, ...next }));

  const { mode } = params;

  const readout = useMemo(() => {
    switch (mode) {
      case 'wire': {
        const b = wireFieldMagnitude(params.current);
        return {
          primary: { label: 'B at 1 cm', value: formatAuto(b, 'T'), detail: 'Field magnitude one centimetre from the wire.' },
          law: {
            title: "Ampère's Law (long wire)",
            formula: 'B = μ₀ I / (2π r)',
            plugged: `${formatAuto(b, 'T')} = μ₀ · ${formatAuto(params.current, 'A')} / (2π · 0.01 m)`,
          },
        };
      }
      case 'solenoid': {
        const b = solenoidField(params.current, params.turns, params.coilLengthCm);
        const n = params.turns / Math.max(1e-4, params.coilLengthCm / 100);
        return {
          primary: { label: 'B inside', value: formatAuto(b, 'T'), detail: `Near-uniform interior field, n = ${formatAuto(n, 'turns/m')}.` },
          law: {
            title: 'Solenoid (interior)',
            formula: 'B = μ₀ n I',
            plugged: `${formatAuto(b, 'T')} = μ₀ · ${formatAuto(n, 'm⁻¹')} · ${formatAuto(params.current, 'A')}`,
          },
        };
      }
      case 'loop': {
        const b = loopCentreField(params.current);
        return {
          primary: { label: 'B at centre', value: formatAuto(b, 'T'), detail: 'On-axis field at the centre of a 5 cm loop.' },
          law: {
            title: 'Current loop (centre)',
            formula: 'B = μ₀ I / (2a)',
            plugged: `${formatAuto(b, 'T')} = μ₀ · ${formatAuto(params.current, 'A')} / (2 · 0.05 m)`,
          },
        };
      }
      case 'two-wire':
      default: {
        const f = forcePerLength(params.current, params.separationCm);
        const signed = params.oppositeCurrent ? -f : f;
        return {
          primary: {
            label: 'Force per length',
            value: `${formatAuto(f, 'N/m')} ${params.oppositeCurrent ? '(repulsive)' : '(attractive)'}`,
            detail: params.oppositeCurrent
              ? 'Opposite currents push the wires apart.'
              : 'Parallel currents pull the wires together.',
          },
          law: {
            title: 'Force between parallel wires',
            formula: 'F/L = μ₀ I₁ I₂ / (2π d)',
            plugged: `${formatAuto(signed, 'N/m')} = μ₀ · ${formatAuto(params.current, 'A')}² / (2π · ${formatAuto(
              params.separationCm / 100,
              'm',
            )})`,
          },
        };
      }
    }
  }, [mode, params]);

  return (
    <div className="min-h-screen bg-[#030712] px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-300/70">
              E&amp;M Module · 3D
            </p>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-cyan-500 hover:text-cyan-100"
            >
              ← Dashboard
            </Link>
          </div>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                3D Magnetic Fields
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                A deeper-dive companion to the 2D magnetic field module. Explore the full 3D shape of
                the field around a straight wire, a solenoid, a current loop, and two parallel wires —
                with live field lines, flowing field-direction particles, and a test compass.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {MODES.map((item) => (
                <ModeButton key={item.id} mode={item} activeMode={mode} onSelect={(m) => patch({ mode: m })} />
              ))}
            </div>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.5fr_0.9fr]">
          <div className="min-h-[34rem] overflow-hidden rounded-3xl border border-white/[0.08] bg-slate-950/70 shadow-2xl shadow-slate-950/40">
            <MagFieldScene params={params} animate={animate} />
          </div>

          <aside className="space-y-5">
            <div className="rounded-3xl border border-white/[0.08] bg-slate-900/55 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Controls</h2>

              <div className="mt-4 space-y-3">
                <ControlSlider
                  label="Current"
                  value={params.current}
                  min={1}
                  max={100}
                  step={1}
                  unit="A"
                  onChange={(v) => patch({ current: v })}
                />

                <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/[0.06] bg-slate-950/45 p-2">
                  <button
                    type="button"
                    onClick={() => patch({ direction: 1 })}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                      params.direction === 1 ? 'bg-cyan-300 text-slate-950' : 'text-slate-400 hover:bg-white/[0.06]'
                    }`}
                  >
                    Direction +
                  </button>
                  <button
                    type="button"
                    onClick={() => patch({ direction: -1 })}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                      params.direction === -1 ? 'bg-cyan-300 text-slate-950' : 'text-slate-400 hover:bg-white/[0.06]'
                    }`}
                  >
                    Direction −
                  </button>
                </div>

                {mode === 'solenoid' ? (
                  <>
                    <ControlSlider label="Turns" value={params.turns} min={4} max={60} step={1} unit="" onChange={(v) => patch({ turns: v })} />
                    <ControlSlider label="Coil radius" value={params.coilRadiusCm} min={5} max={40} step={1} unit="cm" onChange={(v) => patch({ coilRadiusCm: v })} />
                    <ControlSlider label="Coil length" value={params.coilLengthCm} min={20} max={120} step={1} unit="cm" onChange={(v) => patch({ coilLengthCm: v })} />
                  </>
                ) : null}

                {mode === 'two-wire' ? (
                  <>
                    <ControlSlider label="Separation" value={params.separationCm} min={1} max={10} step={0.5} unit="cm" onChange={(v) => patch({ separationCm: v })} />
                    <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/[0.06] bg-slate-950/45 p-2">
                      <button
                        type="button"
                        onClick={() => patch({ oppositeCurrent: false })}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                          !params.oppositeCurrent ? 'bg-cyan-300 text-slate-950' : 'text-slate-400 hover:bg-white/[0.06]'
                        }`}
                      >
                        Same polarity (attract)
                      </button>
                      <button
                        type="button"
                        onClick={() => patch({ oppositeCurrent: true })}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                          params.oppositeCurrent ? 'bg-cyan-300 text-slate-950' : 'text-slate-400 hover:bg-white/[0.06]'
                        }`}
                      >
                        Opposite (repel)
                      </button>
                    </div>
                  </>
                ) : null}

                <div className="rounded-xl border border-white/[0.06] bg-slate-950/45 p-3">
                  <p className="mb-2 text-xs text-slate-300">Field line density</p>
                  <div className="grid grid-cols-3 gap-2">
                    {DENSITIES.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => patch({ density: d })}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize transition ${
                          params.density === d ? 'bg-cyan-300 text-slate-950' : 'text-slate-400 hover:bg-white/[0.06]'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-slate-950/45 p-3">
                  <span className="text-xs text-slate-300">Animate field flow</span>
                  <button
                    type="button"
                    onClick={() => setAnimate((a) => !a)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      animate ? 'bg-cyan-300 text-slate-950' : 'bg-white/[0.06] text-slate-400'
                    }`}
                  >
                    {animate ? 'On' : 'Off'}
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-slate-950/45 p-3">
                  <span className="text-xs text-slate-300">Test compass</span>
                  <button
                    type="button"
                    onClick={() => patch({ showCompass: !params.showCompass })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      params.showCompass ? 'bg-cyan-300 text-slate-950' : 'bg-white/[0.06] text-slate-400'
                    }`}
                  >
                    {params.showCompass ? 'On' : 'Off'}
                  </button>
                </div>

                {params.showCompass ? (
                  <div className="space-y-2 rounded-xl border border-white/[0.06] bg-slate-950/45 p-3">
                    <p className="text-xs text-slate-400">Compass position</p>
                    <ControlSlider label="X" value={params.compass.x} min={-5} max={5} step={0.1} unit="" onChange={(x) => patch({ compass: { ...params.compass, x } })} />
                    <ControlSlider label="Y" value={params.compass.y} min={-5} max={5} step={0.1} unit="" onChange={(y) => patch({ compass: { ...params.compass, y } })} />
                    <ControlSlider label="Z" value={params.compass.z} min={-5} max={5} step={0.1} unit="" onChange={(z) => patch({ compass: { ...params.compass, z } })} />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3">
              <ReadoutCard label={readout.primary.label} value={readout.primary.value} detail={readout.primary.detail} />
              <LawBox title={readout.law.title} formula={readout.law.formula} plugged={readout.law.plugged} />
            </div>
          </aside>
        </section>

        <ConceptBox
          className="mt-6"
          heading="What to notice"
          items={[
            {
              title: 'The right-hand rule sets the swirl',
              description:
                'Point your thumb along the current and your fingers curl the way the field circulates. Flip the current direction and every field line and flowing particle reverses.',
            },
            {
              title: 'A solenoid is a bar magnet',
              description:
                'Inside the coil the field lines run straight and bunch together (near-uniform B = μ₀nI). Outside they spread and loop back from one end to the other, exactly like a bar magnet.',
            },
            {
              title: 'A loop is a dipole',
              description:
                'A single current loop produces the same dipole pattern as the solenoid in miniature — threading up through the centre and wrapping around the outside.',
            },
            {
              title: 'Parallel currents attract',
              description:
                'Two wires with current in the same direction pull together; opposite directions push apart. The force per length follows F/L = μ₀I₁I₂/(2πd).',
            },
          ]}
        />
      </div>
    </div>
  );
}
