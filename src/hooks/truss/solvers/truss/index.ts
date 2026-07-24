// ─────────────────────────────────────────────
//  Truss solver — public API
// ─────────────────────────────────────────────

export { solveTruss } from './solve';
export { solidRoundI, eulerBucklingLoad } from './element';
export { analyzeRestraints } from './restraint';
export type { RestraintAnalysis } from './restraint';
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
