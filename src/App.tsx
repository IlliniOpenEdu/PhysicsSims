import { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import packageJson from '../package.json';

const GA_MEASUREMENT_ID = 'G-RBV8F88DKB';
const FORMSPREE_ENDPOINT = import.meta.env.VITE_FORMSPREE_ENDPOINT as string | undefined;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

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
const AmperesLaw = lazy(() => import('./pages/enm/AmperesLaw').then((m) => ({ default: m.AmperesLaw })));
const Maxwell = lazy(() => import('./pages/enm/Maxwell').then((m) => ({ default: m.Maxwell })));
const FaradaysLaw = lazy(() => import('./pages/enm/FaradaysLaw').then((m) => ({ default: m.FaradaysLaw })));
const RCCircuit = lazy(() => import('./pages/enm/RCCircuit').then((m) => ({ default: m.RCCircuit })));
const GaussLaw = lazy(() => import('./pages/enm/GaussLaw').then((m) => ({ default: m.GaussLaw })));
const MagField = lazy(() => import('./pages/enm/MagField').then((m) => ({ default: m.MagField })));
const BeamBalance = lazy(() => import('./pages/statics/BeamBalance').then((m) => ({ default: m.BeamBalance })));
const DistributedLoad = lazy(() => import('./pages/statics/DistributedLoad').then((m) => ({ default: m.DistributedLoad })));
const EnergyHills = lazy(() => import('./pages/mechanics/EnergyHills').then((m) => ({ default: m.EnergyHills })));

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/#mehcanics', label: 'Mechanics' },
  { to: '/#enm', label: 'E&M' },
  { to: '/#statics', label: 'Statics' },
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
  { path: '/amperes-law', element: <AmperesLaw /> },
  { path: '/maxwell', element: <Maxwell /> },
  { path: '/faradays-law', element: <FaradaysLaw /> },
  { path: '/rc-circuit', element: <RCCircuit /> },
  { path: '/gauss-law', element: <GaussLaw /> },
  { path: '/mag-field', element: <MagField /> },
  { path: '/beam-balance', element: <BeamBalance /> },
  { path: '/distributed-load', element: <DistributedLoad /> },
];

export function App() {
  const location = useLocation();
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);

  useEffect(() => {
    if (typeof window.gtag !== 'function') return;

    const pagePath = `${location.pathname}${location.search}${location.hash}`;

    window.gtag('event', 'page_view', {
      page_path: pagePath,
      page_location: window.location.href,
      page_title: document.title,
      send_to: GA_MEASUREMENT_ID,
    });
  }, [location.pathname, location.search, location.hash]);

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
      <footer className="border-t border-slate-950/90 bg-slate-900/2" >
        <img src="/adl.png" alt="Physics Sims Logo" className="mx-auto h-15 w-15" />
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between ">
          <p>© 2026 PhysicsSsim v{packageJson.version}</p>
          <p className="text-center sm:text-left ">PhET we gon be after yo job</p>
          <div className="flex gap-4">
            <a
              href="https://courses.physics.illinois.edu"
              aria-label="Grainger Engineering Physics Website"
              className="inline-flex items-center justify-center rounded-sm transition hover:scale-105"
            >
              <img src="/uiuc.png" alt="UIUC I-Block" className="h-7 w-7 object-contain" />
            </a>
            <a href="/about" className="hover:text-sky-300">About</a>
            <a
              type="button"
              onClick={() => setIsPrivacyOpen(true)}
              className="hover:text-sky-300"
            >
              Privacy
            </a>
            <a href="https://github.com/Edoubek1024/PhysicsSims?tab=readme-ov-file#contributing" className="hover:text-sky-300">Contribution</a>
            <a
              type="button"
              onClick={() => setIsContactOpen(true)}
              className="hover:text-sky-300"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>

      {isPrivacyOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4"
          onClick={() => setIsPrivacyOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="privacy-modal-title"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl shadow-slate-950/70"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="privacy-modal-title" className="text-lg font-semibold text-slate-100">
              Privacy Notice
            </h2>
            <p className="mt-3 text-sm text-slate-300">
              PhysicsSims does not collect any personal data from users. However, we use Google Analytics to collect anonymous usage data to help us improve the site. 
              This data includes information about your device, browser, and interactions with the site, but it does not include any personally identifiable information. 
              By using PhysicsSims, you consent to the collection of this anonymous usage data.
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setIsPrivacyOpen(false)}
                className="rounded-md bg-blue-300 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isContactOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4"
          onClick={() => setIsContactOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-modal-title"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl shadow-slate-950/70"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="contact-modal-title" className="text-lg font-semibold text-slate-100">
              Contact Us
            </h2>

            {FORMSPREE_ENDPOINT ? (
              <form action={FORMSPREE_ENDPOINT} method="POST" className="mt-4 space-y-3">
                <input type="hidden" name="_subject" value="PhysicsSims Contact Form" />

                <label className="block text-xs font-medium uppercase tracking-wide text-slate-300">
                  Name
                  <input
                    type="text"
                    name="name"
                    required
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
                  />
                </label>

                <label className="block text-xs font-medium uppercase tracking-wide text-slate-300">
                  Email
                  <input
                    type="email"
                    name="email"
                    required
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
                  />
                </label>

                <label className="block text-xs font-medium uppercase tracking-wide text-slate-300">
                  Message
                  <textarea
                    name="message"
                    rows={4}
                    required
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
                  />
                </label>

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsContactOpen(false)}
                    className="rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-400"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-blue-300 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400"
                  >
                    Send
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-3 space-y-4">
                <p className="text-sm text-slate-300">
                  Formspree is not configured yet. Add VITE_FORMSPREE_ENDPOINT in your environment to enable this form.
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsContactOpen(false)}
                    className="rounded-md bg-blue-300 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
    
  );
}