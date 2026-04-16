import type { ColliderLog } from '../../lib/collider/types';

type EventLogProps = {
  logs: ColliderLog[];
};

export function EventLog({ logs }: EventLogProps) {
  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-900/75 p-4 backdrop-blur-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Event Log</p>
      <div className="space-y-2">
        {logs.map((log) => (
          <div key={log.id} className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2">
            <p className="text-[0.62rem] uppercase tracking-[0.08em] text-slate-500">
              {log.kind} · t+{log.time.toFixed(1)}s
            </p>
            <p className="mt-1 text-[0.74rem] text-slate-200">{log.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
