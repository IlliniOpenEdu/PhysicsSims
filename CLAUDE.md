# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start Vite dev server (localhost:5173/PhysicsSims/)
npm run build      # tsc type-check + Vite build + copy dist/index.html → dist/404.html
npm run preview    # preview the production build
npm run lint       # ESLint on src/ (ts,tsx)
npm run deploy     # build then push dist/ to gh-pages branch
```

There is no test suite. Type checking is done via `tsc --noEmit` (run automatically by `npm run build`).

## Architecture

This is a **React + Vite SPA** deployed to GitHub Pages at `https://illiniopenedu.github.io/PhysicsSims`. The `base` URL is `/PhysicsSims/`, so all asset paths and the router `basename` must account for this.

### Routing

All routes are declared in `src/App.tsx` in the `APP_ROUTES` array and rendered with React Router's `<Routes>`. Every simulation page is **lazy-loaded** via `React.lazy` + `Suspense`. Adding a new simulation requires:
1. A page component in `src/pages/`
2. A lazy import and entry in `APP_ROUTES` in `src/App.tsx`
3. An entry in `KNOWN_SIM_PATHS` in `src/config/internalAdmin.ts` (controls admin visibility toggles)

The `?clean=1` query param hides the navbar and footer — used for embedding simulations in iframes.

### Simulation page structure

Each simulation follows a consistent pattern:
- **Page component** (`src/pages/<category>/<Name>.tsx`) — layout, controls, renders the canvas/SVG
- **Physics/math logic** (`src/lib/`) — pure functions, no React, framework-agnostic
- **Custom hooks** (`src/hooks/`) — bridge between lib logic and React state/animation loops

### Key subsystems

**LHC Collider** (`src/pages/enm/LHC.tsx`) — the most architecturally complex simulation:
- Physics runs in a `useRef`-held mutable `ColliderRuntime` object, mutated every RAF tick by `updateSimulation()` in `src/lib/collider/physics.ts`
- React state is only updated via a throttled snapshot (`SNAPSHOT_INTERVAL_MS = 120ms`) to avoid render thrash
- Two canvas views (`RingViewCanvas`, `TunnelViewCanvas`) in `src/components/collider/` draw directly onto `<canvas>` elements

**3D Wave Equation** (`src/pages/enm/wave-3d.tsx`) — uses `@react-three/fiber` + `@react-three/drei`:
- Components in `src/components/wave3d/` are Three.js scene objects (meshes, lines, arrows)
- `src/lib/waveEq/emWave.ts` computes E/B field vectors; `src/lib/waveEq/volumeSampling.ts` builds the 3D arrow volume

**2D Wave equation** (`src/components/waveEq/`) — SVG-based 2D wave visualizer used on the PHYS212 page

### URL state

Two hooks handle persisting simulation parameters to the URL:
- `useQueryState(key, default)` — binds a single numeric value to a query param (history replace, removes param when at default)
- `useUrlStateSync(state, setState, { read, write })` — syncs an entire state object with URL params via caller-provided serialization functions

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
