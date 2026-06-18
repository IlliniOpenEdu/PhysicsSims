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

interface Metadata {
  name: string;
  description: string;
  deviceName: string;
  createdAt: string;
  updatedAt: string;
}

interface SerializedFile {
  app: 'universal-circuit-builder';
  version: number;
  metadata: Metadata;
  schematic: Schematic;
}

function nowIso(): string {
  return new Date().toISOString();
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function sanitizeMetadata(raw: unknown): Metadata {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const now = nowIso();

  return {
    name: str(r.name, 'Untitled Circuit'),
    description: str(r.description),
    deviceName: str(r.deviceName, str(r.author, 'Unknown Device')),
    createdAt: str(r.createdAt, now),
    updatedAt: str(r.updatedAt, now),
  };
}

type NavigatorWithUAData = Navigator & { userAgentData?: { brands?: { brand: string; version: string }[] } };

function getDeviceName(): string {
   const nav = navigator as NavigatorWithUAData;
  if (!nav) return 'Unknown Device';

  const ua = nav.userAgent;
  const platform = nav.platform || '';
  const brands = nav.userAgentData?.brands ?? [];

  const browser =
    brands.find(b => !/Not/i.test(b.brand))?.brand ??
    (/Edg/i.test(ua) ? 'Edge' :
     /OPR|Opera/i.test(ua) ? 'Opera' :
     /Chrome/i.test(ua) ? 'Chrome' :
     /Firefox/i.test(ua) ? 'Firefox' :
     /Safari/i.test(ua) ? 'Safari' :
     'Browser');

  const os =
    /Windows NT 10/i.test(ua) ? 'Windows 10/11' :
    /Windows/i.test(ua) ? 'Windows' :
    /Mac OS X/i.test(ua) ? 'macOS' :
    /iPhone/i.test(ua) ? 'iPhone' :
    /iPad/i.test(ua) ? 'iPad' :
    /Android/i.test(ua) ? 'Android' :
    /Linux/i.test(ua) || /Linux/i.test(platform) ? 'Linux' :
    'Unknown OS';

  const type =
    /Mobi|iPhone|Android/i.test(ua) ? 'Mobile' :
    /iPad|Tablet/i.test(ua) ? 'Tablet' :
    'Desktop';

  return `${os} ${type} · ${browser}`;
}

export function serializeSchematic(
  schematic: Schematic,
  metadata?: Partial<Metadata>,
): string {
  const now = nowIso();

  const payload: SerializedFile = {
    app: 'universal-circuit-builder',
    version: SCHEMA_VERSION,
    metadata: {
      name: metadata?.name ?? 'Untitled Circuit',
      description: metadata?.description ?? '',
      deviceName: metadata?.deviceName ?? getDeviceName(),
      createdAt: metadata?.createdAt ?? now,
      updatedAt: now,
    },
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

  const rotation = ([0, 90, 180, 270].includes(r.rotation as number)
    ? r.rotation
    : 0) as Rotation;

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

    const settings = schematic.settings ?? {
      wireResistance: false,
      wireResistanceOhms: 0.01,
    };

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

export function deserializeCircuitFile(text: string): {
  schematic: Schematic;
  metadata: Metadata;
  version: number;
} | null {
  try {
    const parsed = JSON.parse(text) as Partial<SerializedFile>;
    const schematic = deserializeSchematic(text);

    if (!schematic) return null;

    return {
      schematic,
      metadata: sanitizeMetadata(parsed.metadata),
      version: num(parsed.version, 1),
    };
  } catch {
    return null;
  }
}