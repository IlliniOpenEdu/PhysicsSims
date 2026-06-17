import type { ComponentKind } from '../../lib/circuit/types';
import type { CanvasTool } from './CircuitCanvas';

const TOOLS: { tool: CanvasTool; label: string; glyph: string; hint: string }[] = [
  { tool: 'select', label: 'Select', glyph: '⤲', hint: 'Move, select, draw wires from pins' },
  { tool: 'wire', label: 'Wire', glyph: '╱', hint: 'Click pins/grid to connect' },
  { tool: 'battery', label: 'Battery', glyph: '⎓', hint: 'DC voltage source' },
  { tool: 'acsource', label: 'AC Source', glyph: '∿', hint: 'Sinusoidal source' },
  { tool: 'resistor', label: 'Resistor', glyph: '⊿', hint: 'Ohmic element' },
  { tool: 'capacitor', label: 'Capacitor', glyph: '⊣⊢', hint: 'Stores charge' },
  { tool: 'inductor', label: 'Inductor', glyph: '⌇', hint: 'Stores magnetic energy' },
  { tool: 'switch', label: 'Switch', glyph: '⏛', hint: 'Open / close' },
  { tool: 'ground', label: 'Ground', glyph: '⏚', hint: 'Reference 0 V' },
  { tool: 'voltmeter', label: 'Voltmeter', glyph: 'Ⓥ', hint: 'Ideal V meter' },
  { tool: 'ammeter', label: 'Ammeter', glyph: 'Ⓐ', hint: 'Ideal A meter' },
];

export function Toolbox({ tool, setTool }: { tool: CanvasTool; setTool: (t: CanvasTool) => void }) {
  return (
    <div className="flex h-full flex-col gap-1.5 overflow-y-auto p-2">
      <p className="px-1 pb-1 text-[0.6rem] uppercase tracking-[0.2em] text-sky-400">Toolbox</p>
      {TOOLS.map((t) => {
        const active = tool === t.tool;
        const isComponent = t.tool !== 'select' && t.tool !== 'wire';
        return (
          <button
            key={t.tool}
            type="button"
            title={t.hint}
            onClick={() => setTool(t.tool)}
            className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition ${
              active
                ? 'border-sky-400 bg-sky-500/15 text-sky-100'
                : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-600 hover:bg-slate-900'
            }`}
          >
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md text-base ${isComponent ? 'bg-slate-800 text-cyan-200' : 'bg-slate-800 text-slate-200'}`}>
              {t.glyph}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-medium">{t.label}</span>
              <span className="block truncate text-[0.62rem] text-slate-500">{t.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function isPlacementTool(tool: CanvasTool): tool is ComponentKind {
  return tool !== 'select' && tool !== 'wire';
}
