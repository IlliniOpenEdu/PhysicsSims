import { Component, Suspense, createElement, lazy, useEffect, useMemo, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
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

type LazyLoader<T> = () => Promise<{ default: T }>;

const lazyLoad = <T extends ComponentType<any>>(loader: LazyLoader<T>) => lazy(loader);

const ROUTE_CONFIG = [
  { path: '/', load: () => import('./Home').then((m) => ({ default: m.Home })) },
  { path: '/dashboard', load: () => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })) },
  { path: '/system', load: () => import('./pages/system/status').then((m) => ({ default: m.System })) },
  { path: '/tos', load: () => import('./pages/system/TOS').then((m) => ({ default: m.TOS })) },
  { path: '/TOS', load: () => import('./pages/system/TOS').then((m) => ({ default: m.TOS })) },
  { path: '/privacy', load: () => import('./pages/system/Privacy').then((m) => ({ default: m.Privacy })) },
  { path: '/instructor', load: () => import('./pages/Instructor').then((m) => ({ default: m.Instructor })) },
  { path: '/about', load: () => import('./pages/About').then((m) => ({ default: m.About })) },
  { path: '/partnership', load: () => import('./pages/system/Partnership').then((m) => ({ default: m.Partnership })) },
  { path: '/changelog', load: () => import('./pages/system/Changelog').then((m) => ({ default: m.Changelog })) },
  { path: '/211', load: () => import('./pages/211').then((m) => ({ default: m.Simulations })) },
  { path: '/212', load: () => import('./pages/212').then((m) => ({ default: m.Simulations })) },
  { path: '/T211', load: () => import('./pages/T211').then((m) => ({ default: m.Simulations })) },
  { path: '/kinematics', load: () => import('./pages/mechanics/KinematicsDemo').then((m) => ({ default: m.KinematicsDemo })) },
  { path: '/kinematics-2d', load: () => import('./pages/mechanics/Kinematics2DDemo').then((m) => ({ default: m.Kinematics2DDemo })) },
  { path: '/forces', load: () => import('./pages/mechanics/ForceSimulator').then((m) => ({ default: m.ForceSimulator })) },
  { path: '/gravity-friction', load: () => import('./pages/mechanics/SimpleGravityAndFriction').then((m) => ({ default: m.SimpleGravityAndFriction })) },
  { path: '/box-incline', load: () => import('./pages/mechanics/BoxOnIncline').then((m) => ({ default: m.BoxOnIncline })) },
  { path: '/spring-force', load: () => import('./pages/mechanics/SpringForce').then((m) => ({ default: m.SpringForce })) },
  { path: '/pulley-system', load: () => import('./pages/mechanics/PulleySystem').then((m) => ({ default: m.PulleySystem })) },
  { path: '/energy-hills', load: () => import('./pages/mechanics/EnergyHills').then((m) => ({ default: m.EnergyHills })) },
  { path: '/spring-energy', load: () => import('./pages/mechanics/SpringEnergy').then((m) => ({ default: m.SpringEnergy })) },
  { path: '/work-in-dynamics', load: () => import('./pages/mechanics/WorkInDynamics').then((m) => ({ default: m.WorkInDynamics })) },
  { path: '/center-of-mass', load: () => import('./pages/mechanics/CenterOfMass').then((m) => ({ default: m.CenterOfMass })) },
  { path: '/impulse-builder', load: () => import('./pages/mechanics/ImpulseBuilder').then((m) => ({ default: m.ImpulseBuilder })) },
  { path: '/momentum-collision-1d', load: () => import('./pages/mechanics/MomentumCollision1D').then((m) => ({ default: m.MomentumCollision1D })) },
  { path: '/momentum-collision-2d', load: () => import('./pages/mechanics/Collision2D').then((m) => ({ default: m.Collision2D })) },
  { path: '/orbital-motion', load: () => import('./pages/mechanics/OrbitalMotionPage').then((m) => ({ default: m.OrbitalMotionPage })) },
  { path: '/rotational-taut-string', load: () => import('./pages/mechanics/TautStringCircularMotionPage').then((m) => ({ default: m.TautStringCircularMotionPage })) },
  { path: '/rotational-angular-motion-builder', load: () => import('./pages/mechanics/AngularMotionBuilderPage').then((m) => ({ default: m.AngularMotionBuilderPage })) },
  { path: '/rotational-dynamics-rotating-object-builder', load: () => import('./pages/mechanics/RotatingObjectBuilder').then((m) => ({ default: m.RotatingObjectBuilder })) },
  { path: '/rotational-dynamics-bullet-disk-collision', load: () => import('./pages/mechanics/BulletDiskCollision').then((m) => ({ default: m.BulletDiskCollision })) },
  { path: '/rotational-dynamics-torque-seesaw', load: () => import('./pages/mechanics/TorqueSeesaw').then((m) => ({ default: m.TorqueSeesaw })) },
  { path: '/rotational-dynamics-active-torque-disk', load: () => import('./pages/mechanics/ActiveTorqueDisk').then((m) => ({ default: m.ActiveTorqueDisk })) },
  { path: '/rolling-energy-split', load: () => import('./pages/mechanics/RollingEnergySplit').then((m) => ({ default: m.RollingEnergySplit })) },
  { path: '/oscillations-vertical-spring', load: () => import('./pages/mechanics/VerticalSpringOscillator').then((m) => ({ default: m.VerticalSpringOscillator })) },
  { path: '/oscillations-pendulum', load: () => import('./pages/mechanics/PendulumExplorer').then((m) => ({ default: m.PendulumExplorer })) },
  { path: '/oscillations-wave-generator', load: () => import('./pages/mechanics/oscillations/WaveGenerator').then((m) => ({ default: m.WaveGenerator })) },
  { path: '/oscillations-standing-waves', load: () => import('./pages/mechanics/oscillations/StandingWaves').then((m) => ({ default: m.StandingWaves })) },
  { path: '/frequency-generator', load: () => import('./pages/mechanics/oscillations/FrequencyGen').then((m) => ({ default: m.FrequencyGenerator })) },
  { path: '/pressure-point-explorer', load: () => import('./pages/mechanics/Pressure/PressurePointExplorer').then((m) => ({ default: m.PressurePointExplorer })) },
  { path: '/buoyancy-explorer', load: () => import('./pages/mechanics/Pressure/BuoyancyExplorer').then((m) => ({ default: m.BuoyancyExplorer })) },
  { path: '/ideal-gas-law-explorer', load: () => import('./pages/mechanics/Pressure/IdealGasLawExplorer').then((m) => ({ default: m.IdealGasLawExplorer })) },
  { path: '/fluid-flow-explorer', load: () => import('./pages/mechanics/Pressure/FluidFlowExplorer').then((m) => ({ default: m.FluidFlowExplorer })) },
  { path: '/bernoulli-flow-explorer', load: () => import('./pages/mechanics/Pressure/BernoulliFlowExplorer').then((m) => ({ default: m.BernoulliFlowExplorer })) },
  { path: '/coulombs-law', load: () => import('./pages/enm/CoulombsLaw').then((m) => ({ default: m.CoulombsLaw })) },
  { path: '/amperes-law', load: () => import('./pages/enm/AmperesLaw').then((m) => ({ default: m.AmperesLaw })) },
  { path: '/maxwell', load: () => import('./pages/enm/Maxwell').then((m) => ({ default: m.Maxwell })) },
  { path: '/faradays-law', load: () => import('./pages/enm/FaradaysLaw').then((m) => ({ default: m.FaradaysLaw })) },
  { path: '/capacitor', load: () => import('./pages/enm/Capacitor').then((m) => ({ default: m.Capacitor })) },
  { path: '/rc-circuit', load: () => import('./pages/enm/RCCircuit').then((m) => ({ default: m.RCCircuit })) },
  { path: '/gauss-law', load: () => import('./pages/enm/GaussLaw').then((m) => ({ default: m.GaussLaw })) },
  { path: '/mag-field', load: () => import('./pages/enm/MagField').then((m) => ({ default: m.MagField })) },
  { path: '/mag-field-3d', load: () => import('./pages/enm/3DMagField').then((m) => ({ default: m.MagField3D })) },
  { path: '/lhc', load: () => import('./pages/enm/LHC').then((m) => ({ default: m.LHC })) },
  { path: '/wave-3d', load: () => import('./pages/enm/wave-3d').then((m) => ({ default: m.WaveEquation3D })) },
  { path: '/wave-equation-3d', load: () => import('./pages/enm/wave-3d').then((m) => ({ default: m.WaveEquation3D })) },
  { path: '/optics', load: () => import('./pages/enm/Optics').then((m) => ({ default: m.Optics })) },
  { path: '/universal-circuit-builder', load: () => import('./pages/enm/UniversalCircuitBuilder').then((m) => ({ default: m.UniversalCircuitBuilder })) },
  { path: '/free-body-diagram', load: () => import('./pages/mechanics/FreeBodyDiagram').then((m) => ({ default: m.FreeBodyDiagram })) },
  { path: '/beam-balance', load: () => import('./pages/statics/BeamBalance').then((m) => ({ default: m.BeamBalance })) },
  { path: '/distributed-load', load: () => import('./pages/statics/DistributedLoad').then((m) => ({ default: m.DistributedLoad })) },
  { path: '/heat-transfer', load: () => import('./pages/thermo/HeatTransfer').then((m) => ({ default: m.HeatTransfer })) },


  { path: '/admin', load: () => import('./pages/Admin').then((m) => ({ default: m.Admin })) },
] as const;

const APP_ROUTES = ROUTE_CONFIG.map(({ path, load }) => ({
  path,
  element: createElement(lazyLoad(load)),
}));

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
  { to: '#', label: 'PHYS213 (coming soon)' },
];

// const TAM_LINKS = [{ to: '/T211', label: 'TAM211' }];

type NavLink = {
  to: string;
  label: string;
};

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <div className="rounded-lg border border-rose-800/40 bg-rose-950/20 p-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-rose-400">
              Error boundary caught
            </p>
            <h1 className="mt-3 text-xl font-semibold text-slate-100">Something went wrong</h1>
            <p className="mt-2 font-mono text-sm text-slate-400">{this.state.error.message}</p>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="mt-5 rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
            >
              Dismiss
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function NavDropdown({ label, links }: { label: string; links: NavLink[] }) {
  const { pathname } = useLocation();
  const isActivePath = (path: string) => pathname === path;
  const active = links.some((link) => isActivePath(link.to));
  return (
    <div className="group relative">
      <button
        type="button"
        aria-haspopup="menu"
        className={`inline-flex items-center gap-1 border-b pb-1 text-[0.86rem] font-medium transition group-focus-within:text-cyan-100 ${
          active
            ? 'border-cyan-300 text-cyan-100'
            : 'border-transparent text-slate-300 hover:border-cyan-300/70 hover:text-cyan-200'
        }`}
      >
        {label}
        <span
          aria-hidden="true"
          className="text-[0.7rem] transition-transform duration-200 group-hover:rotate-180 group-focus-within:rotate-180"
        >
          ▾
        </span>
      </button>

      <div className="invisible absolute right-0 top-full z-20 pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div
          role="menu"
          className="min-w-40 origin-top-right translate-y-1 rounded-xl border border-white/10 bg-slate-900/80 p-1 shadow-xl shadow-slate-950/70 backdrop-blur-md transition-transform duration-150 group-hover:translate-y-0 group-focus-within:translate-y-0"
        >
          {links.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              role="menuitem"
              className={`block rounded-lg px-3 py-2 text-[0.82rem] transition ${
                isActivePath(item.to)
                  ? 'bg-cyan-300/20 text-cyan-100'
                  : 'text-slate-300 hover:bg-white/[0.06] hover:text-cyan-200'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function AppNavbar() {
  const { pathname } = useLocation();
  const isActivePath = (path: string) => pathname === path;
  return (
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
              className={`border-b pb-1 text-[0.86rem] font-medium transition ${
                isActivePath(item.to)
                  ? 'border-cyan-300 text-cyan-100'
                  : 'border-transparent text-slate-300 hover:border-cyan-300/70 hover:text-cyan-200'
              }`}
            >
              {item.label}
            </Link>
          ))}
          <NavDropdown label="PHYS" links={PHYS_LINKS} />
          {/* <NavDropdown label="TAM" links={TAM_LINKS} /> */}
        </nav>
      </div>
    </div>
  );
}

function AppFooter({
  onContactOpen,
  onCookieReset,
}: {
  onContactOpen: () => void;
  onCookieReset: () => void;
}) {
  return (
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
            <p className="text-slate-500 text-sm">For students, by students.</p>
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
                  onClick={onContactOpen}
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
                <Link to="/privacy" className="hover:text-white transition">
                  Privacy
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onCookieReset}
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
            © 2026 PhysicsSim v{packageJson.version} • Made with{' '}
            <Link className="text-slate-500" to="/admin">
              ❤
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

function CookieConsentBanner({ onAllow, onDeny }: { onAllow: () => void; onDeny: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
      <div className="mx-auto max-w-6xl rounded-2xl border border-slate-700/80 bg-slate-950/95 p-4 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
              Cookies
            </p>
            <p className="text-sm text-slate-200">
              This site uses cookies to enahance your experiences and analyze traffic. By
              clicking "Allow", you consent to the use of analytics cookies. You can change your
              choice at any time by clicking the "Cookies" button in the footer.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onDeny}
              className="rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-400 hover:bg-slate-900"
            >
              Deny
            </button>
            <button
              type="button"
              onClick={onAllow}
              className="rounded-md bg-sky-300 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400"
            >
              Allow
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4"
      onClick={onClose}
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
                onClick={onClose}
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
              This form is powered by Formspree. Your email will be recorded by Formspree, but
              we will not store or use it for any purpose other than responding to your message.
              Please refer to Formspree's privacy policy for more details. 
              <footer>
                For official university communications, please contact us via our university email at <a className="text-cyan-400">bchen74@illinois.edu</a> or <a className="text-cyan-400">edoub@illinois.edu</a>
              </footer>
            </p>
          </form>
        ) : (
          <div className="mt-3 space-y-4">
            <p className="text-sm text-slate-300">
              Formspree is not working, please configure the FORMSPREE_ENDPOINT to enable the
              contact form.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-blue-300 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function usePageAnalytics({
  cookieConsent,
  pathname,
  search,
  hash,
}: {
  cookieConsent: CookieConsent;
  pathname: string;
  search: string;
  hash: string;
}) {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

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

    const pagePath = `${pathname}${search}${hash}`;

    window.gtag('event', 'page_view', {
      page_path: pagePath,
      page_location: window.location.href,
      page_title: document.title,
      send_to: GA_MEASUREMENT_ID,
    });
  }, [cookieConsent, pathname, search, hash]);

  useEffect(() => {
    const adminState = loadAdminState();
    if (!adminState.featureFlags.analyticsCollection) {
      return;
    }

    pushAnalyticsEvent('page_view', 'Route changed', {
      path: pathname,
      search,
      hash,
    });
  }, [pathname, search, hash]);

  useEffect(() => {
    if (!hash) return;

    const sectionId = hash.slice(1).toLowerCase();
    const target =
      document.getElementById(sectionId) ??
      document.querySelector<HTMLElement>(`[data-hash="${sectionId}"]`);

    if (!target) return;

    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [hash, pathname]);
}

export function App() {
  const { pathname, search, hash } = useLocation();
  const isCleanMode = useMemo(() => {
    const query = new URLSearchParams(search);
    return query.get('clean') === '1' || query.get('clean') === 'true';
  }, [search]);
  const [cookieConsent, setCookieConsent] = useState<CookieConsent>(readStoredCookieConsent);
  const [isContactOpen, setIsContactOpen] = useState(false);

  usePageAnalytics({ cookieConsent, pathname, search, hash });

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      {!isCleanMode && <AppNavbar />}

      <main className="flex-1">
        <ErrorBoundary>
          <Suspense
            fallback={
              <div className="mx-auto min-h-[55vh] max-w-6xl px-4 py-8 text-sm text-slate-400">
                Loading page...
              </div>
            }
          >
            <Routes>
              {APP_ROUTES.map((route) => (
                <Route key={route.path} path={route.path} element={route.element} />
              ))}
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>

      {!isCleanMode && (
        <AppFooter
          onContactOpen={() => setIsContactOpen(true)}
          onCookieReset={() => setCookieConsent('unknown')}
        />
      )}

      {!isCleanMode && cookieConsent === 'unknown' && (
        <CookieConsentBanner
          onAllow={() => setCookieConsent('allow')}
          onDeny={() => setCookieConsent('deny')}
        />
      )}

      {!isCleanMode && isContactOpen && (
        <ContactModal onClose={() => setIsContactOpen(false)} />
      )}
    </div>
  );
}
