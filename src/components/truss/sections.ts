// ─────────────────────────────────────────────
//  Member material/section presets for the truss editor.
//  E and σ_yield come from the shared constants; I of a solid round bar
//  comes from the solver's helper — no inline material numbers.
// ─────────────────────────────────────────────

import { solidRoundI } from '../../solvers/truss/index';
import {
  E_ALUMINUM,
  E_STEEL,
  SIGMA_YIELD_ALUMINUM,
  SIGMA_YIELD_STEEL,
} from '../../utils/constants';

export interface SectionPreset {
  id: string;
  label: string;
  E: number; // Pa
  A: number; // m²
  I: number; // m⁴
  sigmaYield: number; // Pa
}

export const SECTION_PRESETS: SectionPreset[] = [
  {
    id: 'steel-10',
    label: 'Steel bar · 10 cm²',
    E: E_STEEL,
    A: 1e-3,
    I: solidRoundI(1e-3),
    sigmaYield: SIGMA_YIELD_STEEL,
  },
  {
    id: 'steel-40',
    label: 'Steel bar · 40 cm²',
    E: E_STEEL,
    A: 4e-3,
    I: solidRoundI(4e-3),
    sigmaYield: SIGMA_YIELD_STEEL,
  },
  {
    id: 'alu-10',
    label: 'Aluminum bar · 10 cm²',
    E: E_ALUMINUM,
    A: 1e-3,
    I: solidRoundI(1e-3),
    sigmaYield: SIGMA_YIELD_ALUMINUM,
  },
  {
    id: 'alu-40',
    label: 'Aluminum bar · 40 cm²',
    E: E_ALUMINUM,
    A: 4e-3,
    I: solidRoundI(4e-3),
    sigmaYield: SIGMA_YIELD_ALUMINUM,
  },
];

export const CUSTOM_SECTION_ID = 'custom';

export const DEFAULT_SECTION = SECTION_PRESETS[0];

export const findSection = (id: string): SectionPreset | undefined =>
  SECTION_PRESETS.find((s) => s.id === id);
