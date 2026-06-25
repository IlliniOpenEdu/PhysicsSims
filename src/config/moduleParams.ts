// Tunable URL-param schema for the instructor Embed Generator.
//
// Most modules are generated automatically by scripts/genModuleParams.mjs, which
// reads each page's real <SliderWithInput> props (label/queryKey/min/max/step) and
// initial state. Re-run with `npm run gen:module-params` after changing a module's
// controls. Do not hand-edit moduleParams.generated.ts.
//
// This file layers two manual maps on top of the generated output:
//   - MODULE_PARAM_OVERRIDES: modules the codegen cannot resolve — pages that sync
//     via their own useUrlStateSync (forces, pendulum) or a custom-key wrapper
//     (optics). Keys here are taken from those pages' own read/write code.
//   - MODULE_PARAM_EXCLUDE: keys to drop from generated output because the control
//     is mode-gated and inactive in the module's default view (e.g. Capacitor's
//     charge slider only mounts in charge drive mode).

import { GENERATED_MODULE_PARAMS } from './moduleParams.generated';

/** Verbatim copy of toQueryKey() in src/components/SliderWithInput.tsx. */
export function toQueryKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export type NumberParam = {
  kind: 'number';
  label: string;
  /** Explicit URL key. Omit to derive from the label via toQueryKey(). */
  key?: string;
  min: number;
  max: number;
  step: number;
  default: number;
  units?: string;
};

export type BooleanParam = {
  kind: 'boolean';
  label: string;
  key: string;
  default: boolean;
  trueValue?: string; // defaults to '1'
  falseValue?: string; // defaults to '0'
};

export type SelectParam = {
  kind: 'select';
  label: string;
  key: string;
  default: string;
  options: { value: string; label: string }[];
};

export type ModuleParam = NumberParam | BooleanParam | SelectParam;

/** Resolve the URL key a param writes to. */
export function resolveParamKey(param: ModuleParam): string {
  if (param.kind === 'number') {
    return param.key ?? toQueryKey(param.label);
  }
  return param.key;
}

// Modules the codegen can't introspect — keys come from each page's own URL sync code.
const MODULE_PARAM_OVERRIDES: Record<string, ModuleParam[]> = {
  // Page-level useUrlStateSync with custom keys; sliders use syncToUrl={false}.
  '/forces': [
    { kind: 'number', label: 'Object mass', key: 'mass', min: 0.1, max: 20, step: 0.1, default: 10, units: 'kg' },
    { kind: 'boolean', label: 'Gravity', key: 'gravity', default: false },
    { kind: 'number', label: 'Force magnitude', key: 'force', min: 0, max: 20, step: 0.2, default: 5, units: 'N' },
  ],
  '/oscillations-pendulum': [
    { kind: 'number', label: 'Pendulum mass', key: 'm', min: 0.1, max: 100, step: 0.1, default: 2, units: 'kg' },
    { kind: 'number', label: 'Gravity', key: 'g', min: 0.1, max: 25, step: 0.1, default: 9.81, units: 'm/s²' },
    { kind: 'number', label: 'Length', key: 'L', min: 0.5, max: 20, step: 0.1, default: 2.5, units: 'm' },
    {
      kind: 'select',
      label: 'Release mode',
      key: 'mode',
      default: 'angle',
      options: [
        { value: 'angle', label: 'By angle' },
        { value: 'height', label: 'By height' },
      ],
    },
    { kind: 'number', label: 'Release angle', key: 'a', min: -85, max: 85, step: 1, default: 35, units: '°' },
    {
      kind: 'select',
      label: 'Release side',
      key: 'side',
      default: 'right',
      options: [
        { value: 'left', label: 'Left' },
        { value: 'right', label: 'Right' },
      ],
    },
  ],
  // Tabbed page; only the default "spectrum" tab's slider mounts on load, and the
  // active tab is not URL-synced. Key uses Optics' own slug: label.toLowerCase().replace(/\s+/g,'-').
  '/optics': [
    { kind: 'number', label: 'Wavelength', key: 'wavelength', min: 380, max: 700, step: 1, default: 550, units: 'nm' },
  ],
  "/internal-energy": [
    {"kind":"number","label":"Temperature","key":"temperature","min":50,"max":1500,"step":10,"default":300,"units":"K"},
  ],
  "/box-incline": [
    {"kind": "number", "label": "Incline Angle", "key": "θ", "min": 0, "max": 30, "step": 1, "default": 30, "units": "°"},
    {"kind": "number", "label": "Coefficient of Friction", "key": "μs", "min": 0, "max": 1, "step": 0.05, "default": 0.3},
      {"kind": "number", "label": "Coefficient of Kinetic Friction", "key": "μk", "min": 0, "max": 1, "step": 0.05, "default": 0.2},
  ],
  "/work-in-dynamics": [
    {"kind": "number", "label": "Mass", "key": "incline-mass", "min": 0, "max": 20, "step": 0.1, "default": 1, "units": "kg"},
    {"kind": "number", "label": "Angle", "key": "incline-angle", "min": 0, "max": 30, "step": 0.5, "default": 5, "units": "°"},
    {"kind": "number", "label": "μs", "key": "incline-mus", "min": 0, "max": 1, "step": 0.05, "default": 0.3},
    {"kind": "number", "label": "μk", "key": "incline-muk", "min": 0, "max": 1, "step": 0.05, "default": 0.2},
  ]
};

// Generated keys to drop: control exists but is inactive in the module's default view.
const MODULE_PARAM_EXCLUDE: Record<string, string[]> = {
  '/capacitor': ['charge'], // charge slider only mounts in charge drive mode (default is voltage)
};

function withExcludes(route: string, params: ModuleParam[]): ModuleParam[] {
  const excluded = MODULE_PARAM_EXCLUDE[route];
  if (!excluded || excluded.length === 0) return params;
  return params.filter((param) => !excluded.includes(resolveParamKey(param)));
}

/** Map of module route -> tunable params. Routes not present fall back to a bare URL. */
export const MODULE_PARAMS: Record<string, ModuleParam[]> = (() => {
  const merged: Record<string, ModuleParam[]> = {};
  for (const [route, params] of Object.entries(GENERATED_MODULE_PARAMS)) {
    merged[route] = withExcludes(route, params);
  }
  // Overrides win over generated output.
  for (const [route, params] of Object.entries(MODULE_PARAM_OVERRIDES)) {
    merged[route] = params;
  }
  return merged;
})();

/** Default values keyed by resolved URL key, for a module's param list. */
export function defaultParamValues(params: ModuleParam[]): Record<string, number | string | boolean> {
  const values: Record<string, number | string | boolean> = {};
  for (const param of params) {
    values[resolveParamKey(param)] = param.default;
  }
  return values;
}
