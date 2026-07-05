// ─────────────────────────────────────────────
//  Truss solver — public API
//  Phase 2 (UI) consumes exactly this surface and nothing internal.
// ─────────────────────────────────────────────

export { solveTruss } from './solve';
export { solidRoundI, eulerBucklingLoad } from './element';
export { TrussError } from './types';
export type {
  AxialState,
  DofKind,
  DofValue,
  FailureMode,
  Load,
  MemberFailure,
  MemberForce,
  MemberStress,
  Support,
  TrussElement,
  TrussErrorCode,
  TrussNode,
  TrussSolution,
} from './types';
