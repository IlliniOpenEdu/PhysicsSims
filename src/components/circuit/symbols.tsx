import type { CircuitComponent } from '../../lib/circuit/types';
import { withUnit } from '../../lib/circuit/format';

export interface SymbolVisual {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  selected: boolean;
  hovered: boolean;
  /** 0..1 glow intensity (resistor power dissipation). */
  glow: number;
  stroke: string;
  label?: string;
}

const LEAD = '#94a3b8';

function bodyHalfFor(kind: CircuitComponent['kind']): number {
  switch (kind) {
    case 'battery':
    case 'acsource':
      return 14;
    case 'resistor':
      return 22;
    case 'capacitor':
      return 7;
    case 'inductor':
      return 24;
    case 'switch':
      return 18;
    default:
      return 16;
  }
}

function symbolPath(kind: CircuitComponent['kind'], comp: CircuitComponent, stroke: string, half: number) {
  const sw = 2.4;
  switch (kind) {
    case 'resistor':
      return (
        <path
          d={`M ${-half} 0 l 4 -8 l 6 16 l 6 -16 l 6 16 l 6 -16 l 6 16 l 4 -8`}
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      );
    case 'capacitor':
      return (
        <g stroke={stroke} strokeWidth={3} strokeLinecap="round">
          <line x1={-half} y1={-14} x2={-half} y2={14} />
          <line x1={half} y1={-14} x2={half} y2={14} />
        </g>
      );
    case 'inductor':
      return (
        <path
          d={`M ${-half} 0 a 6 6 0 0 1 12 0 a 6 6 0 0 1 12 0 a 6 6 0 0 1 12 0 a 6 6 0 0 1 12 0`}
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap="round"
        />
      );
    case 'battery':
      return (
        <g stroke={stroke} strokeWidth={2.6} strokeLinecap="round">
          <line x1={-6} y1={-13} x2={-6} y2={13} />
          <line x1={4} y1={-7} x2={4} y2={7} strokeWidth={5} />
          <text x={-13} y={-6} fontSize={11} fill={stroke} stroke="none">
            +
          </text>
        </g>
      );
    case 'acsource':
      return (
        <g>
          <circle cx={0} cy={0} r={half} fill="none" stroke={stroke} strokeWidth={2.4} />
          <path
            d="M -8 0 q 4 -9 8 0 q 4 9 8 0"
            fill="none"
            stroke={stroke}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </g>
      );
    case 'switch':
      return (
        <g stroke={stroke} strokeWidth={2.6} strokeLinecap="round">
          <circle cx={-half} cy={0} r={3} fill={stroke} />
          <circle cx={half} cy={0} r={3} fill={stroke} />
          <line x1={-half} y1={0} x2={comp.closed ? half : half - 6} y2={comp.closed ? 0 : -12} />
        </g>
      );
    case 'voltmeter':
      return (
        <g>
          <circle cx={0} cy={0} r={half} fill="none" stroke={stroke} strokeWidth={2.4} />
          <text x={0} y={5} fontSize={14} textAnchor="middle" fill={stroke} stroke="none">
            V
          </text>
        </g>
      );
    case 'ammeter':
      return (
        <g>
          <circle cx={0} cy={0} r={half} fill="none" stroke={stroke} strokeWidth={2.4} />
          <text x={0} y={5} fontSize={14} textAnchor="middle" fill={stroke} stroke="none">
            A
          </text>
        </g>
      );
    default:
      return null;
  }
}

function paramLabel(comp: CircuitComponent): string {
  switch (comp.kind) {
    case 'battery':
      return withUnit(comp.voltage ?? 0, 'V');
    case 'acsource':
      return `${withUnit(comp.voltage ?? 0, 'V')} · ${withUnit(comp.frequency ?? 0, 'Hz')}`;
    case 'resistor':
      return withUnit(comp.resistance ?? 0, 'Ω');
    case 'capacitor':
      return withUnit(comp.capacitance ?? 0, 'F');
    case 'inductor':
      return withUnit(comp.inductance ?? 0, 'H');
    case 'switch':
      return comp.closed ? 'closed' : 'open';
    default:
      return '';
  }
}

export function ComponentSymbol({
  comp,
  visual,
}: {
  comp: CircuitComponent;
  visual: SymbolVisual;
}) {
  const { ax, ay, bx, by, selected, hovered, glow, stroke, label } = visual;

  if (comp.kind === 'ground') {
    return (
      <g transform={`translate(${ax} ${ay})`}>
        <line x1={0} y1={-6} x2={0} y2={6} stroke={LEAD} strokeWidth={2.4} />
        <line x1={-12} y1={6} x2={12} y2={6} stroke={stroke} strokeWidth={2.6} strokeLinecap="round" />
        <line x1={-8} y1={11} x2={8} y2={11} stroke={stroke} strokeWidth={2.6} strokeLinecap="round" />
        <line x1={-4} y1={16} x2={4} y2={16} stroke={stroke} strokeWidth={2.6} strokeLinecap="round" />
        {(selected || hovered) && (
          <circle cx={0} cy={4} r={20} fill="none" stroke="#38bdf8" strokeWidth={1.4} strokeDasharray="3 3" />
        )}
      </g>
    );
  }

  const angle = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
  const length = Math.hypot(bx - ax, by - ay);
  const half = bodyHalfFor(comp.kind);

  return (
    <g transform={`translate(${ax} ${ay}) rotate(${angle})`}>
      {glow > 0.02 && (
        <circle
          cx={length / 2}
          cy={0}
          r={20 + glow * 16}
          fill="#f97316"
          opacity={Math.min(0.5, glow * 0.55)}
          style={{ filter: 'blur(6px)' }}
        />
      )}
      {/* leads */}
      <line x1={0} y1={0} x2={length / 2 - half} y2={0} stroke={LEAD} strokeWidth={2.4} />
      <line x1={length / 2 + half} y1={0} x2={length} y2={0} stroke={LEAD} strokeWidth={2.4} />

      {/* terminal dots */}
      <circle cx={0} cy={0} r={3} fill={LEAD} />
      <circle cx={length} cy={0} r={3} fill={LEAD} />

      <g transform={`translate(${length / 2} 0)`}>
        {(selected || hovered) && (
          <rect
            x={-half - 8}
            y={-20}
            width={(half + 8) * 2}
            height={40}
            rx={8}
            fill={selected ? 'rgba(56,189,248,0.10)' : 'rgba(148,163,184,0.06)'}
            stroke={selected ? '#38bdf8' : 'rgba(148,163,184,0.5)'}
            strokeWidth={1.2}
            strokeDasharray={selected ? undefined : '3 3'}
          />
        )}
        {symbolPath(comp.kind, comp, stroke, half)}
        {/* Counter-rotate the text so it stays upright. */}
        <g transform={`rotate(${-angle})`}>
          <text x={0} y={-26} fontSize={10.5} textAnchor="middle" fill="#cbd5e1" stroke="none">
            {paramLabel(comp)}
          </text>
          {label && (
            <text x={0} y={34} fontSize={10} textAnchor="middle" fill="#7dd3fc" stroke="none">
              {label}
            </text>
          )}
        </g>
      </g>
    </g>
  );
}
