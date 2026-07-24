# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start Vite dev server (localhost:5173/PhysicsSims/)
npm run build      # tsc type-check + Vite build + copy media/ and dist/index.html → dist/404.html
npm run preview    # preview the production build
npm run lint       # ESLint on src/ (ts,tsx) — currently BROKEN: ESLint 9 is installed but only a legacy .eslintrc.cjs exists (needs flat-config migration)
npm run deploy     # build then push dist/ to gh-pages branch
npm run validate:truss     # truss solver checks vs textbook cases (exits non-zero on failure)
npm run gen:module-params  # regenerate src/config module parameter types

npx vitest run     # unit tests (no npm script); tests live in src/lib/**/__tests__/
npx vitest run src/lib/circuit/__tests__/solver.sanity.test.ts   # single test file
```

Type checking is `tsc --noEmit` (run automatically by `npm run build`). Test coverage is thin and targeted: vitest suites for optics/light and the circuit solver, plus the standalone truss validation script — most simulations have no tests.

## Architecture

This is a **React + Vite SPA** deployed to GitHub Pages at `https://physicssims.illiniopenedu.org`. The `base` URL is `/PhysicsSims/`, so all asset paths and the router `basename` must account for this.

### Routing

All routes are declared in `src/App.tsx` in the `APP_ROUTES` array and rendered with React Router's `<Routes>`. Every simulation page is **lazy-loaded** via `React.lazy` + `Suspense`. Adding a new simulation requires:
1. A page component in `src/pages/`
2. A lazy import and entry in `APP_ROUTES` in `src/App.tsx`
3. An entry in `KNOWN_SIM_PATHS` in `src/config/internalAdmin.ts` (controls admin visibility toggles)

The `?clean=1` query param hides the navbar and footer — used for embedding simulations in iframes.

### Simulation page structure

Each simulation follows a consistent pattern:
- **Page component** (`src/pages/<category>/<Name>.tsx`) — layout, controls, renders the canvas/SVG. Categories: `mechanics/` (PHYS 211), `enm/` (PHYS 212), `statics/` (TAM 211), `thermo/` (PHYS 213), `system/` (site pages)
- **Physics/math logic** (`src/lib/<category>/…` and `src/solvers/`) — pure functions, no React, framework-agnostic
- **Custom hooks** (`src/hooks/`) — bridge between lib logic and React state/animation loops

### Key subsystems

**Truss Solver** (`src/pages/statics/TrussSolver.tsx`) — 2D/3D structural editor with layered architecture:
- `src/solvers/truss/` — pure direct-stiffness solver (DOF-general via `DofMap`; SVD solve doubles as the mechanism detector; `restraint.ts` rank-checks restrained DOF against rigid-body modes). Validated by `npm run validate:truss`
- `src/components/truss/editorState.ts` — the bridge that shapes editor state into solver input; `supports.ts` is the single support-kind → restrained-DOF resolver (pin/roller/custom `ux/uy/uz`) — never map support labels to stability anywhere else
- `src/components/truss/serialization.ts` — versioned JSON import/export (`physics-sims/truss`); keep old `pin`/`roller`/`none` files parseable
- `useTrussEditor` hook owns state; two viewports (`TrussCanvas2D` canvas, `TrussScene3D` react-three-fiber)

**LHC Collider** (`src/pages/enm/LHC.tsx`) — the most architecturally complex simulation:
- Physics runs in a `useRef`-held mutable `ColliderRuntime` object, mutated every RAF tick by `updateSimulation()` in `src/lib/enm/collider/physics.ts`
- React state is only updated via a throttled snapshot (`SNAPSHOT_INTERVAL_MS = 120ms`) to avoid render thrash
- Two canvas views (`RingViewCanvas`, `TunnelViewCanvas`) in `src/components/collider/` draw directly onto `<canvas>` elements

**3D Wave Equation** (`src/pages/enm/wave-3d.tsx`) — uses `@react-three/fiber` + `@react-three/drei`:
- Components in `src/components/wave3d/` are Three.js scene objects (meshes, lines, arrows)
- `src/lib/enm/waveEq/emWave.ts` computes E/B field vectors; `src/lib/enm/waveEq/volumeSampling.ts` builds the 3D arrow volume

**2D Wave equation** (`src/components/waveEq/`) — SVG-based 2D wave visualizer used on the PHYS212 page

**Circuit Builder** (`src/lib/circuit/` + `src/components/circuit/`) — sandbox R/L/C circuit solver with sanity tests in `src/lib/circuit/__tests__/`

**Analytics** — `track()` in `src/utils/analytics.ts` fire-and-forgets POSTs to `/api/analytics`, implemented as a Vercel serverless function in `backend/api/analytics.ts` that inserts into Supabase (needs `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` server-side). The GitHub Pages build has no backend, so tracking silently no-ops there.

### URL state

Two hooks handle persisting simulation parameters to the URL:
- `useQueryState(key, default)` — binds a single numeric value to a query param (history replace, removes param when at default)
- `useUrlStateSync(state, setState, { read, write })` — syncs an entire state object with URL params via caller-provided serialization functions

### Utility Files

- `src\utils\formatters.ts` — number formatting, unit conversions, and SI prefix formatting
- `src\utils\mathUtils.ts` — vector math, matrix math, and other general-purpose math utilities
- `src\utils\constants.ts` — physical constants, unit conversions, and other global constants

### Admin panel

`/admin` route — a hidden, localStorage-backed control panel (`src/config/internalAdmin.ts`). Only accessible when `window.location.hostname` is localhost/internal, or when `VITE_INTERNAL_ADMIN_ENABLED=true`. Controls feature flags, simulation visibility, content overrides, and an announcement popup.

### Styling

Tailwind CSS utility classes throughout. No component library. Color palette is dark (slate-950 background). Prettier config: single quotes, trailing commas, 100-char print width.

### Environment variables

| Variable | Purpose |
|---|---|
| `VITE_FORMSPREE_ENDPOINT` | Enables the contact form in the footer |
| `VITE_INTERNAL_ADMIN_ENABLED` | Unlocks `/admin` on non-localhost hosts |

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
