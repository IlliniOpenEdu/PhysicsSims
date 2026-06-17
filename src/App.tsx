import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import packageJson from '../package.json';
import { loadAdminState, pushAnalyticsEvent } from './config/internalAdmin';

const GA_MEASUREMENT_ID = 'G-5XJFVLZQ0Z';
const GA_SCRIPT_ID = 'google-analytics-gtag';
const COOKIE_CONSENT_KEY = 'physicssims-cookie-consent';
const FORMSPREE_ENDPOINT = import.meta.env.VITE_FORMSPREE_ENDPOINT as string | undefined;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

type CookieConsent = 'unknown' | 'allow' | 'deny';

const readStoredCookieConsent = (): CookieConsent => {
  try {
    const storedConsent = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    if (storedConsent === 'allow' || storedConsent === 'deny') {
      return storedConsent;
    }
  } catch {
    // localStorage may be unavailable (e.g. private browsing with strict settings)
  }
  return 'unknown';
};

declare global {
  interface Window {
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}

const setAnalyticsDisabled = (disabled: boolean) => {
  window[`ga-disable-${GA_MEASUREMENT_ID}`] = disabled;
};

const initializeGtagStub = () => {
  if (typeof window.gtag === 'function') {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    void args;
    window.dataLayer?.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, { send_page_view: false });
};

const loadAnalyticsScript = () => {
  if (document.getElementById(GA_SCRIPT_ID)) {
    return;
  }

  const script = document.createElement('script');
  script.id = GA_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);
};

const Home = lazy(() => import('./Home').then((m) => ({ default: m.Home })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const System = lazy(() => import('./pages/system/status').then((m) => ({ default: m.System })));
const TOS = lazy(() => import('./pages/system/TOS').then((m) => ({ default: m.TOS })));
const About = lazy(() => import('./pages/About').then((m) => ({ default: m.About })));
const Instructor = lazy(() => import('./pages/Instructor').then((m) => ({ default: m.Instructor })));
const Phys211 = lazy(() => import('./pages/211').then((m) => ({ default: m.Simulations })));
const Phys212 = lazy(() => import('./pages/212').then((m) => ({ default: m.Simulations })));
const TAM211 = lazy(() => import('./pages/T211').then((m) => ({ default: m.Simulations })));

const KinematicsDemo = lazy(() => import('./pages/mechanics/KinematicsDemo').then((m) => ({ default: m.KinematicsDemo })));
const Kinematics2DDemo = lazy(() => import('./pages/mechanics/Kinematics2DDemo').then((m) => ({ default: m.Kinematics2DDemo })));
const ForceSimulator = lazy(() => import('./pages/mechanics/ForceSimulator').then((m) => ({ default: m.ForceSimulator })));
const SimpleGravityAndFriction = lazy(() => import('./pages/mechanics/SimpleGravityAndFriction').then((m) => ({ default: m.SimpleGravityAndFriction })));
const BoxOnIncline = lazy(() => import('./pages/mechanics/BoxOnIncline').then((m) => ({ default: m.BoxOnIncline })));
const SpringForce = lazy(() => import('./pages/mechanics/SpringForce').then((m) => ({ default: m.SpringForce })));
const PulleySystem = lazy(() => import('./pages/mechanics/PulleySystem').then((m) => ({ default: m.PulleySystem })));
const EnergyHills = lazy(() => import('./pages/mechanics/EnergyHills').then((m) => ({ default: m.EnergyHills })));
const SpringEnergy = lazy(() => import('./pages/mechanics/SpringEnergy').then((m) => ({ default: m.SpringEnergy })));
const WorkInDynamics = lazy(() => import('./pages/mechanics/WorkInDynamics').then((m) => ({ default: m.WorkInDynamics })));

const ColumbsLaw = lazy(() => import('./pages/enm/ColumbsLaw').then((m) => ({ default: m.ColumbsLaw })));
const AmperesLaw = lazy(() => import('./pages/enm/AmperesLaw').then((m) => ({ default: m.AmperesLaw })));
const Maxwell = lazy(() => import('./pages/enm/Maxwell').then((m) => ({ default: m.Maxwell })));
const FaradaysLaw = lazy(() => import('./pages/enm/FaradaysLaw').then((m) => ({ default: m.FaradaysLaw })));
const CapacitorLab = lazy(() => import('./pages/enm/Capacitor').then((m) => ({ default: m.Capacitor })));
const RCCircuit = lazy(() => import('./pages/enm/RCCircuit').then((m) => ({ default: m.RCCircuit })));
const GaussLaw = lazy(() => import('./pages/enm/GaussLaw').then((m) => ({ default: m.GaussLaw })));
const MagField = lazy(() => import('./pages/enm/MagField').then((m) => ({ default: m.MagField })));
const LHC = lazy(() => import('./pages/enm/LHC').then((m) => ({ default: m.LHC })));
const WaveEq3D = lazy(() => import('./pages/enm/wave-3d').then((m) => ({ default: m.WaveEquation3D })));
const Optics = lazy(() => import('./pages/enm/Optics').then((m) => ({ default: m.Optics })));

const BeamBalance = lazy(() => import('./pages/statics/BeamBalance').then((m) => ({ default: m.BeamBalance })));
const DistributedLoad = lazy(() => import('./pages/statics/DistributedLoad').then((m) => ({ default: m.DistributedLoad })));
const CenterOfMass = lazy(() => import('./pages/mechanics/CenterOfMass').then((m) => ({ default: m.CenterOfMass })));
const ImpulseBuilder = lazy(() => import('./pages/mechanics/ImpulseBuilder').then((m) => ({ default: m.ImpulseBuilder })));
const MomentumCollision1D = lazy(() => import('./pages/mechanics/MomentumCollision1D').then((m) => ({ default: m.MomentumCollision1D })));
const Collision2D = lazy(() => import('./pages/mechanics/Collision2D').then((m) => ({ default: m.Collision2D })));
const TautStringCircularMotionPage = lazy(() => import('./pages/mechanics/TautStringCircularMotionPage').then((m) => ({ default: m.TautStringCircularMotionPage })));
const AngularMotionBuilderPage = lazy(() => import('./pages/mechanics/AngularMotionBuilderPage').then((m) => ({ default: m.AngularMotionBuilderPage })));
const OrbitalMotionPage = lazy(() => import('./pages/mechanics/OrbitalMotionPage').then((m) => ({ default: m.OrbitalMotionPage })));
const RotatingObjectBuilder = lazy(() => import('./pages/mechanics/RotatingObjectBuilder').then((m) => ({ default: m.RotatingObjectBuilder })));
const BulletDiskCollision = lazy(() => import('./pages/mechanics/BulletDiskCollision').then((m) => ({ default: m.BulletDiskCollision })));
const TorqueSeesaw = lazy(() => import('./pages/mechanics/TorqueSeesaw').then((m) => ({ default: m.TorqueSeesaw })));
const ActiveTorqueDisk = lazy(() => import('./pages/mechanics/ActiveTorqueDisk').then((m) => ({ default: m.ActiveTorqueDisk })));
const RollingEnergySplit = lazy(() => import('./pages/mechanics/RollingEnergySplit').then((m) => ({ default: m.RollingEnergySplit })));

const Admin = lazy(() => import('./pages/Admin').then((m) => ({ default: m.Admin })));
const Changelog = lazy(() => import('./pages/system/Changelog').then((m) => ({ default: m.Changelog })));
const Partnership = lazy(() => import('./pages/system/Partnership').then((m) => ({ default: m.Partnership })));

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  // { to: '/instructor', label: 'Instructor' },
  // { to: '/#mechanics', label: 'Mechanics' },
  // { to: '/#enm', label: 'E&M' },
  // { to: '/#statics', label: 'Statics' },
];

const PHYS_LINKS = [
  { to: '/211', label: 'PHYS211' },
  { to: '/212', label: 'PHYS212' },
];

const TAM_LINKS = [
  { to: '/T211', label: 'TAM211' },
]

const APP_ROUTES = [
  { path: '/', element: <Home /> },
  { path: '/dashboard', element: <Dashboard /> },
  { path: '/system', element: <System /> },
  { path: '/tos', element: <TOS /> },
  { path: '/TOS', element: <TOS /> },
  { path: '/instructor', element: <Instructor /> },
  { path: '/about', element: <About /> },
  { path: '/partnership', element: <Partnership /> },
  { path: '/changelog', element: <Changelog /> },
  { path: '/211', element: <Phys211 /> },
  { path: '/212', element: <Phys212 /> },
  { path: '/T211', element: <TAM211 /> },
  { path: '/kinematics', element: <KinematicsDemo /> },
  { path: '/kinematics-2d', element: <Kinematics2DDemo /> },
  { path: '/forces', element: <ForceSimulator /> },
  { path: '/gravity-friction', element: <SimpleGravityAndFriction /> },
  { path: '/box-incline', element: <BoxOnIncline /> },
  { path: '/spring-force', element: <SpringForce /> },
  { path: '/pulley-system', element: <PulleySystem /> },
  { path: '/energy-hills', element: <EnergyHills /> },
  { path: '/spring-energy', element: <SpringEnergy /> },
  { path: '/work-in-dynamics', element: <WorkInDynamics /> },
  { path: '/center-of-mass', element: <CenterOfMass /> },
  { path: '/impulse-builder', element: <ImpulseBuilder /> },
  { path: '/momentum-collision-1d', element: <MomentumCollision1D /> },
  { path: '/momentum-collision-2d', element: <Collision2D /> },
  { path: '/orbital-motion', element: <OrbitalMotionPage /> },
  { path: '/rotational-taut-string', element: <TautStringCircularMotionPage /> },
  { path: '/rotational-angular-motion-builder', element: <AngularMotionBuilderPage /> },
  { path: '/rotational-dynamics-rotating-object-builder', element: <RotatingObjectBuilder /> },
  { path: '/rotational-dynamics-bullet-disk-collision', element: <BulletDiskCollision /> },
  { path: '/rotational-dynamics-torque-seesaw', element: <TorqueSeesaw /> },
  { path: '/rotational-dynamics-active-torque-disk', element: <ActiveTorqueDisk /> },
  { path: '/rolling-energy-split', element: <RollingEnergySplit /> },
  { path: '/columbs-law', element: <ColumbsLaw /> },
  { path: '/amperes-law', element: <AmperesLaw /> },
  { path: '/maxwell', element: <Maxwell /> },
  { path: '/faradays-law', element: <FaradaysLaw /> },
  { path: '/capacitor', element: <CapacitorLab /> },
  { path: '/rc-circuit', element: <RCCircuit /> },
  { path: '/gauss-law', element: <GaussLaw /> },
  { path: '/mag-field', element: <MagField /> },
  { path: '/lhc', element: <LHC /> },
  { path: '/wave-3d', element: <WaveEq3D /> },
  { path: '/wave-equation-3d', element: <WaveEq3D /> },
  { path: '/optics', element: <Optics /> },
  { path: '/beam-balance', element: <BeamBalance /> },
  { path: '/distributed-load', element: <DistributedLoad /> },
  { path: '/admin', element: <Admin /> },
];

export function App() {
  const location = useLocation();
  const isCleanMode = useMemo(() => {
    const query = new URLSearchParams(location.search);
    return query.get('clean') === '1' || query.get('clean') === 'true';
  }, [location.search]);
  const [cookieConsent, setCookieConsent] = useState<CookieConsent>(readStoredCookieConsent);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const isActivePath = (path: string) => location.pathname === path;
  const isGroupActive = (links: Array<{ to: string; label: string }>) =>
    links.some((link) => isActivePath(link.to));

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  useEffect(() => {
    if (cookieConsent === 'unknown') {
      return;
    }

    try {
      window.localStorage.setItem(COOKIE_CONSENT_KEY, cookieConsent);
    } catch {
      // localStorage may be unavailable in restricted environments
    }
    setAnalyticsDisabled(cookieConsent === 'deny');

    if (cookieConsent !== 'allow') {
      return;
    }

    initializeGtagStub();
    loadAnalyticsScript();
  }, [cookieConsent]);

  useEffect(() => {
    if (cookieConsent !== 'allow' || typeof window.gtag !== 'function') return;

    const pagePath = `${location.pathname}${location.search}${location.hash}`;

    window.gtag('event', 'page_view', {
      page_path: pagePath,
      page_location: window.location.href,
      page_title: document.title,
      send_to: GA_MEASUREMENT_ID,
    });
  }, [cookieConsent, location.pathname, location.search, location.hash]);

  useEffect(() => {
    const adminState = loadAdminState();
    if (!adminState.featureFlags.analyticsCollection) {
      return;
    }

    pushAnalyticsEvent('page_view', 'Route changed', {
      path: location.pathname,
      search: location.search,
      hash: location.hash,
    });
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    if (!location.hash) return;

    const hash = location.hash.slice(1).toLowerCase();
    const normalizedHash = hash;
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
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      {!isCleanMode ? (
      <div className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs sm:flex-nowrap">
          <Link
            to="/"
            className="group inline-flex min-w-[10.5rem] items-center gap-2 font-semibold tracking-[0.16em] text-cyan-200 transition hover:text-cyan-100"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 transition group-hover:scale-125" />
            PHYSICS SIMS
          </Link>

          <nav className="flex min-h-[2.25rem] flex-1 items-center justify-end gap-4 whitespace-nowrap text-[0.86rem] leading-5">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`border-b pb-1 text-[0.86rem] font-medium transition ${isActivePath(item.to) ? 'border-cyan-300 text-cyan-100' : 'border-transparent text-slate-300 hover:border-cyan-300/70 hover:text-cyan-200'}`}
              >
                {item.label}
              </Link>
            ))}
            <div className="group relative">
              <button
                type="button"
                className={`inline-flex items-center gap-1 border-b pb-1 text-[0.86rem] font-medium transition ${isGroupActive(PHYS_LINKS) ? 'border-cyan-300 text-cyan-100' : 'border-transparent text-slate-300 hover:border-cyan-300/70 hover:text-cyan-200'} group-focus-within:text-cyan-100`}
                aria-haspopup="menu"
              >
                PHYS
                <span aria-hidden="true">▾</span>
              </button>
              <div
                className="invisible absolute right-0 top-full z-20 mt-2 min-w-32 rounded-xl border border-white/10 bg-slate-900/95 p-1 opacity-0 shadow-xl shadow-slate-950/70 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
                role="menu"
              >
                {PHYS_LINKS.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    role="menuitem"
                    className={`block rounded-lg px-3 py-2 text-[0.82rem] transition ${isActivePath(item.to) ? 'bg-cyan-300/20 text-cyan-100' : 'text-slate-300 hover:bg-white/[0.06] hover:text-cyan-200'}`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="group relative">
              <button
                type="button"
                className={`inline-flex items-center gap-1 border-b pb-1 text-[0.86rem] font-medium transition ${isGroupActive(TAM_LINKS) ? 'border-cyan-300 text-cyan-100' : 'border-transparent text-slate-300 hover:border-cyan-300/70 hover:text-cyan-200'} group-focus-within:text-cyan-100`}
                aria-haspopup="menu"
              >
                TAM
                <span aria-hidden="true">▾</span>
              </button>
              <div
                className="invisible absolute right-0 top-full z-20 mt-2 min-w-32 rounded-xl border border-white/10 bg-slate-900/95 p-1 opacity-0 shadow-xl shadow-slate-950/70 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
                role="menu"
              >
                {TAM_LINKS.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    role="menuitem"
                    className={`block rounded-lg px-3 py-2 text-[0.82rem] transition ${isActivePath(item.to) ? 'bg-cyan-300/20 text-cyan-100' : 'text-slate-300 hover:bg-white/[0.06] hover:text-cyan-200'}`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </nav>
        </div>
      </div>
      ) : null}

      {/* ROUTES */}
      <main className="flex-1">
        <Suspense fallback={<div className="mx-auto min-h-[55vh] max-w-6xl px-4 py-8 text-sm text-slate-400">Loading page...</div>}>
          <Routes>
            {APP_ROUTES.map((route) => (
              <Route key={route.path} path={route.path} element={route.element} />
            ))}
          </Routes>
        </Suspense>
      </main>
      
      {/* FOOTER BOX */}
      {!isCleanMode ? (
      <footer className="border-t border-white/[0.05] py-12 px-4 bg-white/[0.015]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center font-bold text-[#030507] text-xs">
                  φ
                </div>
                <span className="font-bold">PhysicsSims</span>
              </div>
              <p className="text-slate-500 text-sm">
                For students, by students.
              </p>
              <p className="text-slate-600 text-xs mt-3">Version {packageJson.version}</p>
            </div>

            <div>
              <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-slate-400">
                Product
              </h3>
              <ul className="space-y-2 text-sm text-slate-500">
                <li>
                  <Link to="/dashboard" className="hover:text-white transition">
                    Simulations
                  </Link>
                </li>
                <li>
                  <Link to="/system" className="hover:text-white transition">
                    Server Status
                  </Link>
                </li>
                <li>
                  <Link to="/about" className="hover:text-white transition">
                    About
                  </Link>
                </li>
                <li>
                  <Link to="/changelog" className="hover:text-white transition">
                    Changelog
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-slate-400">
                Resources
              </h3>
              <ul className="space-y-2 text-sm text-slate-500">
                <li>
                  <a
                    href="https://github.com/IlliniOpenEdu/PhysicsSims"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white transition"
                  >
                    GitHub
                  </a>
                </li>
                <li>
                  <Link to="/instructor" className="hover:text-amber-400 transition">
                    Instructors
                  </Link>
                </li>
                <li>
                  <a
                    href="https://github.com/IlliniOpenEdu/PhysicsSims/wiki"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white transition"
                  >
                    Documentations
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setIsContactOpen(true)}
                    className="hover:text-white transition"
                  >
                    Contact
                  </button>
                </li>
                <li>
                  <Link to="/partnership" className="hover:text-emerald-400 transition">
                    Partnership
                  </Link>
                </li>
              </ul>
              
            </div>

            <div>
              <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-slate-400">
                Legal
              </h3>
              <ul className="space-y-2 text-sm text-slate-500">
                <li>
                  <Link to="/TOS" className="hover:text-white transition">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setIsPrivacyOpen(true)}
                    className="hover:text-white transition"
                  >
                    Privacy
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setCookieConsent('unknown')}
                    className="hover:text-white transition"
                  >
                    Cookies
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/[0.05] pt-8 text-center text-sm text-slate-600">
            <p>
              © 2026 PhysicsSim v{packageJson.version} • Made with <Link className="text-red-500" to="/admin">❤</Link>
            </p>
          </div>
        </div>
      </footer>
      ) : null}

      {!isCleanMode && isPrivacyOpen ? (
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
              PhysicsSims does not collect personal data from users. Anonymous usage tracking with Google Analytics only starts after you allow cookies.
              The tracking data includes device, browser, and interaction information, but it does not include personally identifiable information.
              You can change your choice with the Cookies button in the footer.
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

      {!isCleanMode && cookieConsent === 'unknown' ? (
        <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
          <div className="mx-auto max-w-6xl rounded-2xl border border-slate-700/80 bg-slate-950/95 p-4 shadow-2xl shadow-slate-950/70 backdrop-blur">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Cookies</p>
                <p className="text-sm text-slate-200">
                  This site uses cookies to enahance your experiences and analyze traffic. By clicking "Allow", you consent to the use of analytics cookies. You can change your choice at any time by clicking the "Cookies" button in the footer.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setCookieConsent('deny')}
                  className="rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-400 hover:bg-slate-900"
                >
                  Deny
                </button>
                <button
                  type="button"
                  onClick={() => setCookieConsent('allow')}
                  className="rounded-md bg-sky-300 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400"
                >
                  Allow
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {!isCleanMode && isContactOpen ? (
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
                <p className="text-xs text-slate-500">
                  This form is powered by Formspree. Your email will be recorded by Formspree, but we will not store or use it for any purpose other than responding to your message. Please refer to Formspree's privacy policy for more details.
                </p>
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
