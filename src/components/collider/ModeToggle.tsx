import type { ViewMode } from '../../lib/collider/types';

type ModeToggleProps = {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
};

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-900/80 p-2">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onChange('ring')}
          className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
            mode === 'ring' ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          Ring View
        </button>
        <button
          onClick={() => onChange('tunnel')}
          className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
            mode === 'tunnel'
              ? 'bg-sky-500 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          Tunnel View
        </button>
      </div>
    </div>
  );
}
