import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import packageJson from '../package.json';


const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })));
const About = lazy(() => import('./pages/About').then((m) => ({ default: m.About })));
const Simulations = lazy(() => import('./pages/Simulations').then((m) => ({ default: m.Simulations })));
const KinematicsDemo = lazy(() => import('./pages/mechanics/KinematicsDemo').then((m) => ({ default: m.KinematicsDemo })));
const Kinematics2DDemo = lazy(() => import('./pages/mechanics/Kinematics2DDemo').then((m) => ({ default: m.Kinematics2DDemo })));
const ForceSimulator = lazy(() => import('./pages/mechanics/ForceSimulator').then((m) => ({ default: m.ForceSimulator })));
const SimpleGravityAndFriction = lazy(() => import('./pages/mechanics/SimpleGravityAndFriction').then((m) => ({ default: m.SimpleGravityAndFriction })));
const BoxOnIncline = lazy(() => import('./pages/mechanics/BoxOnIncline').then((m) => ({ default: m.BoxOnIncline })));
const SpringForce = lazy(() => import('./pages/mechanics/SpringForce').then((m) => ({ default: m.SpringForce })));
const PulleySystem = lazy(() => import('./pages/mechanics/PulleySystem').then((m) => ({ default: m.PulleySystem })));
const ColumbsLaw = lazy(() => import('./pages/enm/ColumbsLaw').then((m) => ({ default: m.ColumbsLaw })));
const FaradaysLaw = lazy(() => import('./pages/enm/FaradaysLaw').then((m) => ({ default: m.FaradaysLaw })));
const RCCircuit = lazy(() => import('./pages/enm/RCCircuit').then((m) => ({ default: m.RCCircuit })));
const GaussLaw = lazy(() => import('./pages/enm/GaussLaw').then((m) => ({ default: m.GaussLaw })));
const MagField = lazy(() => import('./pages/enm/MagField').then((m) => ({ default: m.MagField })));
const BeamBalance = lazy(() => import('./pages/statics/BeamBalance').then((m) => ({ default: m.BeamBalance })));
const DistributedLoad = lazy(() => import('./pages/statics/DistributedLoad').then((m) => ({ default: m.DistributedLoad })));
const EnergyHills = lazy(() => import('./pages/EnergyHills').then((m) => ({ default: m.EnergyHills })));

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/#mehcanics', label: 'Mechanics' },
  { to: '/#enm', label: 'E&M' },
  { to: '/#statics', label: 'Statics' },
  { to: '/about', label: 'About' },
  { to: '/simulations', label: 'PHYS211' },
];

const APP_ROUTES = [
  { path: '/', element: <Home /> },
  { path: '/about', element: <About /> },
  { path: '/simulations', element: <Simulations /> },
  { path: '/kinematics', element: <KinematicsDemo /> },
  { path: '/kinematics-2d', element: <Kinematics2DDemo /> },
  { path: '/forces', element: <ForceSimulator /> },
  { path: '/gravity-friction', element: <SimpleGravityAndFriction /> },
  { path: '/box-incline', element: <BoxOnIncline /> },
  { path: '/spring-force', element: <SpringForce /> },
  { path: '/pulley-system', element: <PulleySystem /> },
  { path: '/energy-hills', element: <EnergyHills /> },
  { path: '/columbs-law', element: <ColumbsLaw /> },
  { path: '/faradays-law', element: <FaradaysLaw /> },
  { path: '/rc-circuit', element: <RCCircuit /> },
  { path: '/gauss-law', element: <GaussLaw /> },
  { path: '/mag-field', element: <MagField /> },
  { path: '/beam-balance', element: <BeamBalance /> },
  { path: '/distributed-load', element: <DistributedLoad /> },
];

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
            {NAV_LINKS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-[0.9rem] text-slate-300 transition hover:text-sky-300"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* ROUTES */}
      <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-400">Loading simulation...</div>}>
        <Routes>
          {APP_ROUTES.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </Routes>
      </Suspense>
      
{/* FOOTER BOX */}
      <footer className="border-t border-slate-800 bg-slate-950/90" >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between ">
          <p>© 2026 PhysicsSsim v{packageJson.version}</p>
          <p className="text-center sm:text-left ">PhET we gon be after yo job</p>
          <div className="flex gap-4">
            <a href="https://github.com/Edoubek1024/PhysicsSims?tab=readme-ov-file#contributing" className="hover:text-sky-300">Contribution</a>
            <a href="#" className="hover:text-sky-300">Resources</a>
            <a href="#" className="hover:text-sky-300">Terms</a>
            <a href="#" className="hover:text-sky-300">Contact</a>
          </div>
        </div>
      </footer>
    </div>
    
  );
}