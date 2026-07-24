// ─────────────────────────────────────────────
//  Support → DOF resolver, shared by 2D and 3D.
//  The single place where support kinds become restrained axes: the solve
//  bridge, serialization and the inspector all resolve through here, so
//  stability is always judged on restrained DOF, never on labels. A roller
//  restrains y only — in 3D it does NOT hold the structure laterally
//  unless the user picks a custom support that fixes x or z explicitly.
// ─────────────────────────────────────────────

import type { DofKind } from '../../hooks/truss/solvers/truss/index';

export type SupportKind = 'none' | 'pin' | 'roller' | 'custom';

export const SUPPORT_KINDS: SupportKind[] = ['none', 'pin', 'roller', 'custom'];

/** Per-axis translational restraint flags (uz is meaningful only in 3D). */
export interface SupportRestraint {
  ux: boolean;
  uy: boolean;
  uz: boolean;
}

/** Canonical restrained axes for a support kind (custom reads its flags). */
export function supportRestraint(
  kind: SupportKind,
  restraint: SupportRestraint | undefined,
  is3d: boolean,
): SupportRestraint {
  switch (kind) {
    case 'pin':
      return { ux: true, uy: true, uz: is3d };
    case 'roller':
      return { ux: false, uy: true, uz: false };
    case 'custom':
      return { ux: !!restraint?.ux, uy: !!restraint?.uy, uz: is3d && !!restraint?.uz };
    default:
      return { ux: false, uy: false, uz: false };
  }
}

/** Solver DOF list for a support — the boundary conditions use exactly this. */
export function supportDofs(
  kind: SupportKind,
  restraint: SupportRestraint | undefined,
  is3d: boolean,
): DofKind[] {
  const r = supportRestraint(kind, restraint, is3d);
  const dofs: DofKind[] = [];
  if (r.ux) dofs.push('tx');
  if (r.uy) dofs.push('ty');
  if (r.uz) dofs.push('tz');
  return dofs;
}