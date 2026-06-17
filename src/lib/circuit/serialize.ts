import type { CircuitComponent, ComponentKind, Rotation, Schematic, Wire } from './types';

const SCHEMA_VERSION = 1;
const VALID_KINDS: ComponentKind[] = [
  'battery',
  'acsource',
  'resistor',
  'capacitor',
  'inductor',
  'switch',
  'ground',
  'voltmeter',
  'ammeter',
];

interface SerializedFile {
  app: 'universal-circuit-builder';
  version: number;
  schematic: Schematic;
}

export function serializeSchematic(schematic: Schematic): string {
  const payload: SerializedFile = {
    app: 'universal-circuit-builder',
    version: SCHEMA_VERSION,
    schematic,
  };
  return JSON.stringify(payload, null, 2);
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function sanitizeComponent(raw: unknown): CircuitComponent | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const kind = r.kind as ComponentKind;
  if (!VALID_KINDS.includes(kind)) return null;
  const rotation = ([0, 90, 180, 270].includes(r.rotation as number) ? r.rotation : 0) as Rotation;
  const comp: CircuitComponent = {
    id: typeof r.id === 'string' ? r.id : `c-${Math.random().toString(36).slice(2, 9)}`,
    kind,
    x: num(r.x, 0),
    y: num(r.y, 0),
    rotation,
    length: num(r.length, kind === 'ground' ? 0 : 2),
  };
  const optional: (keyof CircuitComponent)[] = [
    'voltage',
    'resistance',
    'capacitance',
    'inductance',
    'frequency',
    'phase',
    'internalResistance',
    'initialVoltage',
    'initialCurrent',
  ];
  for (const key of optional) {
    if (typeof r[key] === 'number' && Number.isFinite(r[key] as number)) {
      (comp[key] as number) = r[key] as number;
    }
  }
  if (typeof r.closed === 'boolean') comp.closed = r.closed;
  return comp;
}

function sanitizeWire(raw: unknown): Wire | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const a = r.a as Record<string, unknown> | undefined;
  const b = r.b as Record<string, unknown> | undefined;
  if (!a || !b) return null;
  return {
    id: typeof r.id === 'string' ? r.id : `w-${Math.random().toString(36).slice(2, 9)}`,
    a: { x: num(a.x, 0), y: num(a.y, 0) },
    b: { x: num(b.x, 0), y: num(b.y, 0) },
  };
}

export function deserializeSchematic(text: string): Schematic | null {
  try {
    const parsed = JSON.parse(text) as Partial<SerializedFile>;
    const schematic = parsed.schematic;
    if (!schematic) return null;
    const components = Array.isArray(schematic.components)
      ? (schematic.components.map(sanitizeComponent).filter(Boolean) as CircuitComponent[])
      : [];
    const wires = Array.isArray(schematic.wires)
      ? (schematic.wires.map(sanitizeWire).filter(Boolean) as Wire[])
      : [];
    const settings = schematic.settings ?? { wireResistance: false, wireResistanceOhms: 0.01 };
    return {
      components,
      wires,
      settings: {
        wireResistance: Boolean(settings.wireResistance),
        wireResistanceOhms: num(settings.wireResistanceOhms, 0.01),
      },
    };
  } catch {
    return null;
  }
}
