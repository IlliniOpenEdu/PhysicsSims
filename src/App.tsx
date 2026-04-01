import { Routes, Route, Link } from 'react-router-dom';
import { Home } from './pages/Home';
import { Simulations } from './pages/Simulations';
import { KinematicsDemo } from './pages/KinematicsDemo';
import { Kinematics2DDemo } from './pages/Kinematics2DDemo';
import { ForceSimulator } from './pages/ForceSimulator';
import { SimpleGravityAndFriction } from './pages/SimpleGravityAndFriction';
import { BoxOnIncline } from './pages/BoxOnIncline';
import { SpringForce } from './pages/SpringsForce';
import { PulleySystem } from './pages/PulleySystem';

export function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="border-b border-slate-800/80 bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 text-xs">
          <Link
            to="/"
            className="flex items-center gap-2 font-semibold tracking-[0.18em] text-sky-300"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            PHYSICS SIMS
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              to="/"
              className="text-[0.7rem] text-slate-300 transition hover:text-sky-300"
            >
              Home
            </Link>
            <Link
              to="/simulations"
              className="text-[0.7rem] text-slate-300 transition hover:text-sky-300"
            >
              Simulations
            </Link>
          </nav>
        </div>
      </div>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/simulations" element={<Simulations />} />
        <Route path="/kinematics" element={<KinematicsDemo />} />
        <Route path="/kinematics-2d" element={<Kinematics2DDemo />} />
        <Route path="/forces" element={<ForceSimulator />} />
        <Route path="/gravity-friction" element={<SimpleGravityAndFriction />} />
        <Route path="/box-incline" element={<BoxOnIncline />} />
        <Route path="/spring-force" element={<SpringForce />} />
        <Route path="/pulley-system" element={<PulleySystem />} />
      </Routes>
    </div>
  );
}
