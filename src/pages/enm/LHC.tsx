import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ControlPanel } from '../../components/collider/ControlPanel';
import { EventLog } from '../../components/collider/EventLog';
import { LiveReadout } from '../../components/collider/LiveReadout';
import { ModeToggle } from '../../components/collider/ModeToggle';
import { RingViewCanvas } from '../../components/collider/RingViewCanvas';
import { TunnelViewCanvas } from '../../components/collider/TunnelViewCanvas';
import { COLLIDER_LABEL } from '../../lib/collider/constants';
import { useColliderSimulation } from '../../hooks/useColliderSimulation';

type EducationTab = 'how' | 'magnets' | 'acceleration' | 'collisions' | 'detectors';

const EDUCATION_COPY: Record<EducationTab, string> = {
  how: 'Charged bunches circulate in a ring while radio-frequency sectors top up their energy each lap. At interaction points, opposite beams overlap and produce measurable collision events.',
  magnets:
    'Dipole-like sectors bend charged particles into a circular trajectory. Raising magnetic field strength boosts confinement, so beam packets stay tighter and machine glow increases.',
  acceleration:
    'Electric acceleration sectors add energy in short bursts. Higher beam energy increases bunch speed, brighter trails, and stronger event intensity at detector points.',
  collisions:
    'When counter-rotating bunches overlap at detector stations, the simulation emits a collision flash and radiating tracks. Event intensity scales with beam energy and overlap quality.',
  detectors:
    'Detectors are simplified sensing layers around interaction points. Sensitivity controls how rich the observed track pattern appears, mimicking tracker and calorimeter responses.',
};

export function LHC() {
  const {
    controls,
    setControl,
    mode,
    setMode,
    isPlaying,
    togglePlay,
    reset,
    runtimeRef,
    snapshot,
    readout,
  } = useColliderSimulation();

  const [educationTab, setEducationTab] = useState<EducationTab>('how');

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">ENM Advanced Module</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            {COLLIDER_LABEL}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Large Hadron Collider sim for magnetic confinement, beam acceleration, and
            collision detection.
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-sky-500 hover:text-sky-100"
        >
          <span className="text-sm">←</span>
          Back to welcome
        </Link>
      </header>

      <section className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-4 rounded-2xl border border-slate-700/70 bg-slate-900/65 p-4 shadow-2xl shadow-slate-950/60 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
              Simulation View
            </p>
            <ModeToggle mode={mode} onChange={setMode} />
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950">
            {mode === 'ring' ? (
              <RingViewCanvas runtimeRef={runtimeRef} controls={controls} />
            ) : (
              <TunnelViewCanvas runtimeRef={runtimeRef} controls={controls} />
            )}
          </div>
        </div>

        <div className="space-y-4">
          <ControlPanel
            controls={controls}
            onChange={setControl}
            isPlaying={isPlaying}
            onTogglePlay={togglePlay}
            onReset={reset}
          />
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LiveReadout
          beamEnergy={readout.beamEnergy}
          magneticField={readout.magneticField}
          bunchCount={readout.bunchCount}
          collisionRate={readout.collisionRate}
          particleType={readout.particleType}
          detectorSensitivity={readout.detectorSensitivity}
          collisionsEnabled={readout.collisionsEnabled}
        />
        <EventLog logs={snapshot.logs} />
      </section>

      <section className="rounded-2xl border border-slate-700/70 bg-slate-900/75 p-5 backdrop-blur-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Learning Panel</p>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
          <button
            onClick={() => setEducationTab('how')}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
              educationTab === 'how'
                ? 'bg-sky-500 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            How It Works
          </button>
          <button
            onClick={() => setEducationTab('magnets')}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
              educationTab === 'magnets'
                ? 'bg-sky-500 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Magnets
          </button>
          <button
            onClick={() => setEducationTab('acceleration')}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
              educationTab === 'acceleration'
                ? 'bg-sky-500 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Acceleration
          </button>
          <button
            onClick={() => setEducationTab('collisions')}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
              educationTab === 'collisions'
                ? 'bg-sky-500 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Collisions
          </button>
          <button
            onClick={() => setEducationTab('detectors')}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
              educationTab === 'detectors'
                ? 'bg-sky-500 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Detectors
          </button>
        </div>

        <p className="mt-4 max-w-4xl rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm leading-6 text-slate-200">
          {EDUCATION_COPY[educationTab]}
        </p>
      </section>
    </div>
  );
}
