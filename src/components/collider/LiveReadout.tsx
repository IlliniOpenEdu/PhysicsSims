type LiveReadoutProps = {
  beamEnergy: number;
  magneticField: number;
  bunchCount: number;
  collisionRate: number;
  particleType: string;
  detectorSensitivity: number;
  collisionsEnabled: boolean;
};

export function LiveReadout({
  beamEnergy,
  magneticField,
  bunchCount,
  collisionRate,
  particleType,
  detectorSensitivity,
  collisionsEnabled,
}: LiveReadoutProps) {
  const rows = [
    { label: 'Beam Energy', value: `${beamEnergy.toFixed(0)} GeV` },
    { label: 'Magnetic Field', value: `${magneticField.toFixed(1)} T` },
    { label: 'Active Bunches', value: String(bunchCount) },
    { label: 'Particle Type', value: particleType[0].toUpperCase() + particleType.slice(1) },
    { label: 'Collision Activity', value: `${collisionRate.toFixed(2)} Hz` },
    { label: 'Detector Sensitivity', value: `${Math.round(detectorSensitivity * 100)}%` },
    { label: 'Detector Status', value: collisionsEnabled ? 'Listening' : 'Standby' },
  ];

  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-900/75 p-4 backdrop-blur-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Live Readouts</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rows.map((r) => {
          const isPrimary = r.label === 'Beam Energy' || r.label === 'Magnetic Field' || r.label === 'Collision Activity';
          return (
            <div
              key={r.label}
              className={`rounded-lg border px-3 py-2 ${
                isPrimary
                  ? 'border-cyan-400/30 bg-cyan-500/10'
                  : 'border-slate-800 bg-slate-950/70'
              }`}
            >
              <p className="text-[0.65rem] uppercase tracking-[0.12em] text-slate-400">{r.label}</p>
              <p className={`mt-1 text-sm font-semibold ${isPrimary ? 'text-cyan-100' : 'text-slate-100'}`}>
                {r.value}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
