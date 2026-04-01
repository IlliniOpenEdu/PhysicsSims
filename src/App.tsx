import { useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home } from './pages/Home';
import { About } from './pages/About';
import { Simulations } from './pages/Simulations';
import { KinematicsDemo } from './pages/mechanics/KinematicsDemo';
import { Kinematics2DDemo } from './pages/mechanics/Kinematics2DDemo';
import { ForceSimulator } from './pages/mechanics/ForceSimulator';
import { SimpleGravityAndFriction } from './pages/mechanics/SimpleGravityAndFriction';
import { BoxOnIncline } from './pages/mechanics/BoxOnIncline';
import { SpringForce } from './pages/SpringForce';
import { ColumbsLaw } from './pages/enm/ColumbsLaw';
import { GaussLaw } from './pages/enm/GaussLaw';
import { MagField } from './pages/enm/MagField';
import { BeamBalance } from './pages/statics/BeamBalance';
import { PulleySystem } from './pages/PulleySystem';

export function App() {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;

    const hash = location.hash.slice(1).toLowerCase();
    const normalizedHash = hash === 'mehcanics' ? 'mechanics' : hash;
    const target =
      document.getElementById(normalizedHash) ??
      document.querySelector<HTMLElement>(`[data-hash="${hash}"]`);

    if (!target) return;

    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [location.hash, location.pathname]);

  // NAVBAR + ROUTES
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
              className="text-[0.9rem] text-slate-300 transition hover:text-sky-300"
            >
              Home
            </Link>
            <Link
              to="/#mehcanics"
              className="text-[0.9rem] text-slate-300 transition hover:text-sky-300"
            >
              Mechanics
            </Link>
            <Link
              to="/#enm"
              className="text-[0.9rem] text-slate-300 transition hover:text-sky-300"
            >
              E&M
            </Link>
            <Link
              to="/#statics"
              className="text-[0.9rem] text-slate-300 transition hover:text-sky-300"
            >
              Statics
            </Link>
            <Link
              to="about"
              className="text-[0.9rem] text-slate-300 transition hover:text-sky-300"
            >
              About
            </Link>
            <Link
              to="/simulations"
              className="text-[0.9rem] text-slate-300 transition hover:text-sky-300"
            >
              Simulations
            </Link>
          </nav>
        </div>
      </div>

{/* ROUTES */}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/simulations" element={<Simulations />} />
        <Route path="/kinematics" element={<KinematicsDemo />} />
        <Route path="/kinematics-2d" element={<Kinematics2DDemo />} />
        <Route path="/forces" element={<ForceSimulator />} />
        <Route path="/gravity-friction" element={<SimpleGravityAndFriction />} />
        <Route path="/box-incline" element={<BoxOnIncline />} />
        <Route path="/spring-force" element={<SpringForce />} />
        <Route path="/columbs-law" element={<ColumbsLaw />} />
        <Route path="/gauss-law" element={<GaussLaw />} />
        <Route path="/mag-field" element={<MagField />} />
        <Route path="/beam-balance" element={<BeamBalance />} />
        <Route path="/pulley-system" element={<PulleySystem />} />
      </Routes>
      
{/* FOOTER BOX */}
      <footer className="border-t border-slate-800 bg-slate-950/90" >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between ">
          <p>© 2026 PhysicsSsim</p>
          <p className="text-center sm:text-left ">This website is better in landscape mode.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-sky-300">Contribution</a>
            <a href="#" className="hover:text-sky-300">Resources</a>
            <a href="#" className="hover:text-sky-300">Terms</a>
            <a href="#" className="hover:text-sky-300">Contact</a>
          </div>
        </div>
      </footer>
    </div>
    
  );
}
