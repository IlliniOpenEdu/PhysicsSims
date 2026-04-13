import { Suspense, lazy, useEffect, useState } from 'react';
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

const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })));
const About = lazy(() => import('./pages/About').then((m) => ({ default: m.About })));
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
const SpringEnergy = lazy(() => import('./pages/mechanics/SpringEnergy').then((m) => ({ default: m.SpringEnergy })));
const WorkInDynamics = lazy(() => import('./pages/WorkInDynamics').then((m) => ({ default: m.WorkInDynamics })));
const Admin = lazy(() => import('./pages/Admin').then((m) => ({ default: m.Admin })));

const NAV_LINKS = [
  { to: '/', label: 'Home' },
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
  { path: '/about', element: <About /> },
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
  { path: '/columbs-law', element: <ColumbsLaw /> },
  { path: '/amperes-law', element: <AmperesLaw /> },
  { path: '/maxwell', element: <Maxwell /> },
  { path: '/faradays-law', element: <FaradaysLaw /> },
  { path: '/rc-circuit', element: <RCCircuit /> },
  { path: '/gauss-law', element: <GaussLaw /> },
  { path: '/mag-field', element: <MagField /> },
  { path: '/beam-balance', element: <BeamBalance /> },
  { path: '/distributed-load', element: <DistributedLoad /> },
  { path: '/admin', element: <Admin /> },
];

export function App() {
  const location = useLocation();
  const [cookieConsent, setCookieConsent] = useState<CookieConsent>(readStoredCookieConsent);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const isActivePath = (path: string) => location.pathname === path;
  const isGroupActive = (links: Array<{ to: string; label: string }>) =>
    links.some((link) => isActivePath(link.to));

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
      <footer className="border-t border-slate-950/90 bg-slate-900/2" >
        <img
          src={`${import.meta.env.BASE_URL}adl.png`}
          alt="Physics Sims Logo"
          width={56}
          height={56}
          className="mx-auto h-14 w-14"
        />
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 text-sm text-slate-400 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <p className="sm:justify-self-start">© 2026 PhysicsSim v{packageJson.version}</p>
          <p className="text-center sm:justify-self-center">Made with <Link className="text-red-500" to="/admin">❤</Link></p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:justify-self-end sm:justify-end">
            <a
              href="https://courses.physics.illinois.edu"
              aria-label="Grainger Engineering Physics Website"
              className="inline-flex items-center justify-center rounded-sm transition hover:scale-105"
            >
              <img
                src={`${import.meta.env.BASE_URL}uiuc.png`}
                alt="UIUC I-Block"
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
              />
            </a>
            <Link to="/about" className="hover:text-sky-300">About</Link>
            <a
              type="button"
              onClick={() => setIsPrivacyOpen(true)}
              className="hover:text-sky-300"
            >
              Privacy
            </a>
            <a
              type="button"
              onClick={() => setCookieConsent('unknown')}
              className="hover:text-sky-300"
            >
              Cookies
            </a>
            <a href="https://github.com/IlliniOpenEdu/PhysicsSims?tab=readme-ov-file#contributing" className="hover:text-sky-300">Contribution</a>
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

      {cookieConsent === 'unknown' ? (
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
