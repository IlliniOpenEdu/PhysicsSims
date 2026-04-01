# PhysicsSims

Interactive, browser-native physics simulations built with React + TypeScript.

PhysicsSims is designed for students who want to *see* the math happen: tweak parameters, watch behavior change instantly, and build intuition for mechanics, E&M, and statics.

PhET we are coming for you. Better watch out, PhET.

## Why This Exists

Too many classroom sims are either visually outdated or overloaded with friction-heavy UI.

PhysicsSims aims for:

- clear controls
- readable visuals
- physically meaningful behavior
- modern, fast frontend architecture

## Current Simulation Library

### Mechanics

- 1-D Kinematics
- 2-D Kinematics
- Force Simulator
- Simple Friction (Rope Pull)
- Box on Incline

### Electricity and Magnetism

- Coulomb's Law Explorer
- Gauss's Law Visualizer

### Statics

- Beam Balance Simulator

## Tech Stack

- React 18
- TypeScript
- Vite
- React Router
- Tailwind CSS

## Quick Start

```bash
git clone https://github.com/Edoubek1024/PhysicsSims.git
cd PhysicsSims
npm install
npm run dev
```

Open the local URL shown by Vite (typically `http://localhost:5173`).

## Scripts

```bash
npm run dev      # start development server
npm run build    # type-check + production build
npm run preview  # preview production build locally
npm run lint     # run eslint
```

## Project Structure

```text
src/
	pages/
		mechanics/
		enm/
		statics/
	components/
	styles/
```

## Design Principles

- **Visual first:** concepts should be obvious before reading formulas
- **Physics honest:** assumptions are explicit, behavior stays physically grounded
- **Student centered:** quick experimentation beats buried controls

## Roadmap

- Faraday's Law simulator
- Ampere's Law simulator
- Maxwell's equations explorer
- More statics and rigid-body modules

## Contributing

Issues, ideas, and improvements are welcome.

If you want to contribute:

1. Fork the repo
2. Create a feature branch
3. Commit focused changes
4. Open a pull request with screenshots or short clips for UI-heavy updates

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
