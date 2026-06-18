import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { initEasterEgg } from './utils/easteregg';
import { loadAdminState } from './config/internalAdmin';
import { AnnouncementPopup } from './components/AnnouncementPopup';
import UnderMaintenanceBanner from './components/UnderMaintenanceBanner';
import HalideLanding from './components/ui/HalideLanding';

const ease = [0.22, 1, 0.36, 1] as const;

function OrbitalVisual() {
  return (
    <div className="relative w-full h-44 flex items-center justify-center overflow-hidden select-none pointer-events-none">
      <div className="absolute w-24 h-24 rounded-full bg-blue-500/10 blur-3xl" />
      {[80, 130, 176].map((diameter, i) => (
        <motion.div
          key={diameter}
          className="absolute rounded-full border border-blue-400/20"
          style={{ width: diameter, height: diameter }}
          animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
          transition={{ duration: 6 + i * 4, repeat: Infinity, ease: 'linear' }}
        >
          <div
            className="absolute rounded-full"
            style={{
              width: 8, height: 8,
              top: -4, left: '50%', marginLeft: -4,
              background: ['#60a5fa', '#22d3ee', '#34d399'][i],
              boxShadow: `0 0 10px 3px ${['rgba(96,165,250,0.7)', 'rgba(34,211,238,0.7)', 'rgba(52,211,153,0.7)'][i]}`,
            }}
          />
        </motion.div>
      ))}
      <div className="relative z-10 w-3.5 h-3.5 rounded-full bg-white/90 shadow-[0_0_15px_6px_rgba(255,255,255,0.25)]" />
    </div>
  );
}

function WaveVisual() {
  return (
    <div className="relative h-24 overflow-hidden select-none pointer-events-none">
      <motion.div
        className="absolute flex items-center"
        style={{ width: '200%', top: '50%', transform: 'translateY(-50%)' }}
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      >
        <svg viewBox="0 0 600 60" className="w-full h-16" preserveAspectRatio="none">
          <path
            d="M0,30 C25,5 50,55 75,30 C100,5 125,55 150,30 C175,5 200,55 225,30 C250,5 275,55 300,30 C325,5 350,55 375,30 C400,5 425,55 450,30 C475,5 500,55 525,30 C550,5 575,55 600,30"
            fill="none" stroke="url(#wv)" strokeWidth="1.5"
          />
          <defs>
            <linearGradient id="wv" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
              <stop offset="25%" stopColor="#38bdf8" />
              <stop offset="75%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </motion.div>
    </div>
  );
}

const NET_NODES = [
  { x: 45, y: 35 }, { x: 115, y: 22 }, { x: 82, y: 78 },
  { x: 165, y: 58 }, { x: 205, y: 22 }, { x: 232, y: 82 },
];
const NET_EDGES = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5], [4, 5]];

function NetworkVisual() {
  return (
    <div className="relative h-28 overflow-hidden select-none pointer-events-none">
      <svg viewBox="0 0 275 105" className="w-full h-full">
        {NET_EDGES.map(([a, b], i) => (
          <motion.line
            key={i}
            x1={NET_NODES[a].x} y1={NET_NODES[a].y}
            x2={NET_NODES[b].x} y2={NET_NODES[b].y}
            stroke="#a78bfa" strokeWidth="0.7"
            animate={{ strokeOpacity: [0.1, 0.35, 0.1] }}
            transition={{ duration: 2.5, delay: i * 0.35, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
        {NET_NODES.map((n, i) => (
          <motion.circle
            key={i}
            cx={n.x}
            cy={n.y}
            r="3.5"
            fill="#a78bfa"
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            animate={{ opacity: [0.4, 1, 0.4], scale: [0.85, 1.15, 0.85] }}
            transition={{ duration: 2.5, delay: i * 0.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </svg>
    </div>
  );
}

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full z-50 backdrop-blur-md bg-[#030507]/80 border-b border-white/[0.05]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            {/* link to svg */}
            <img
              src={`${import.meta.env.BASE_URL}phiLogo.svg`}
              alt="PhysicsSims logo"
              className="w-8 h-8"
            />
            <span className="text-lg font-bold text-white hidden sm:inline">PhysicsSims</span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            <Link
              to="/about"
              className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/[0.05] transition-all duration-200"
            >
              About
            </Link>
            <Link
              to="/changelog"
              className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/[0.05] transition-all duration-200"
            >
              Changelog
            </Link>
            <a
              href="https://github.com/IlliniOpenEdu/PhysicsSims"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/[0.05] transition-all duration-200"
            >
              GitHub
            </a>
          </div>

          {/* CTA Button */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/dashboard"
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-semibold hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-200 active:scale-95"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-white/[0.05] text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={isOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
              />
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <motion.div
            className="md:hidden bg-[#0c1018] border-t border-white/[0.05]"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="px-2 py-3 space-y-1">
              <Link
                to="/about"
                className="block px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/[0.05] transition-all"
              >
                About
              </Link>
              <Link
                to="/changelog"
                className="block px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/[0.05] transition-all"
              >
                Changelog
              </Link>
              <a
                href="https://github.com/IlliniOpenEdu/PhysicsSims"
                target="_blank"
                rel="noreferrer"
                className="block px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/[0.05] transition-all"
              >
                GitHub
              </a>
              <Link
                to="/dashboard"
                className="block mt-2 px-3 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-semibold text-center"
              >
                Explore Labs
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </nav>
  );
}

export function Home() {
  useEffect(() => initEasterEgg(), []);

  const [adminControls, setAdminControls] = useState(loadAdminState);
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);
  const experimentalMechanicsEnabled = adminControls.featureFlags.experimentalMechanics;

  useEffect(() => {
    const onStorage = () => setAdminControls(loadAdminState());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    try {
      if (!adminControls.announcement.enabled) {
        setIsAnnouncementOpen(false);
        return;
      }

      const dismissKey = `home-announcement-dismissed:${adminControls.announcement.id}`;
      const dismissed = window.localStorage.getItem(dismissKey) === 'true';
      setIsAnnouncementOpen(!dismissed);
    } catch {
      setIsAnnouncementOpen(false);
    }
  }, [adminControls.announcement]);

  useEffect(() => {
    if (!experimentalMechanicsEnabled) {
      return;
    }

    const previousTransition = document.body.style.transition;
    const previousFilter = document.body.style.filter;

    document.body.style.transition = 'filter 0.6s ease';
    document.body.style.filter = 'hue-rotate(35deg) saturate(1.3)';

    return () => {
      document.body.style.transition = previousTransition;
      document.body.style.filter = previousFilter;
    };
  }, [experimentalMechanicsEnabled]);

  const featuredSimPath = adminControls.contentOverrides.featuredSimPath || '/dashboard';

  if (adminControls.bugTestControls.forceHomeError) {
    throw new Error('[Admin] Forced home error — triggered from admin panel bug/test controls.');
  }

  return (
    <div className="bg-[#030507] text-white min-h-screen">
      {adminControls.announcement.enabled ? (
        <AnnouncementPopup
          announcement={{
            id: adminControls.announcement.id,
            title: adminControls.announcement.title,
            description: adminControls.announcement.description,
            buttons: [
              { text: adminControls.announcement.primaryButtonText, url: adminControls.announcement.primaryButtonUrl, newTab: adminControls.announcement.openPrimaryInNewTab },
            ],
          }}
          isOpen={isAnnouncementOpen}
          showDismiss
          onClose={() => {
            try {
              window.localStorage.setItem(`home-announcement-dismissed:${adminControls.announcement.id}`, 'true');
            } catch {
              // ignore
            }
            setIsAnnouncementOpen(false);
          }}
        />
      ) : null}
      {adminControls.featureFlags.maintenanceMode ? (
        <div className="fixed inset-x-0 top-20 z-[80] flex justify-center pointer-events-none">
            <UnderMaintenanceBanner 
            statusUrl='/system'
            />
        </div>
      ) : null}
      <Navbar />

      {/* Hero Section */}
      <HalideLanding
        title={adminControls.contentOverrides.homeHeroTitle}
        subtitle={adminControls.contentOverrides.homeHeroSubtitle}
        tagline={adminControls.contentOverrides.homeHeroTagline}
      />

      {/* Stats Section */}
      <motion.section
        className="relative py-16 px-4 border-y border-white/[0.05] bg-white/[0.015]"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 md:gap-16">
            {[
              { label: '45+', desc: 'Simulations' },
              { label: '5', desc: 'Physics Tracks' },
              { label: 'FREE', desc: 'Forever' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <p className="text-3xl sm:text-4xl font-bold">{stat.label}</p>
                <p className="text-slate-500 text-sm uppercase tracking-wider mt-2">{stat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Features Section */}
      <section className="relative py-32 px-4 overflow-hidden">
        {/* Ambient glows */}
        <div className="pointer-events-none absolute inset-0 select-none overflow-hidden">
          <div className="absolute -top-32 left-1/4 w-96 h-96 rounded-full bg-blue-600/5 blur-3xl" />
          <div className="absolute top-1/2 right-0 w-80 h-80 rounded-full bg-purple-600/5 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-cyan-600/5 blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            className="text-center mb-20"
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease }}
          >
            <span className="inline-block px-4 py-1.5 rounded-full border border-blue-400/20 bg-blue-400/5 text-blue-300 text-[0.7rem] font-semibold uppercase tracking-[0.25em] mb-6">
              Features
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
              Built different.{' '}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Feels different.
              </span>
            </h2>
            <p className="text-slate-400 mt-4 text-lg max-w-xl mx-auto">
              Built for understanding, not memorization
            </p>
          </motion.div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Card A — Interactive Labs (2/3 wide) */}
            <motion.div
              className="md:col-span-2 relative rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden group cursor-default"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, ease }}
              whileHover={{ y: -4 }}
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at 65% 0%, rgba(59,130,246,0.14), transparent 65%)' }}
              />
              <div className="flex flex-col sm:flex-row h-full">
                <div className="flex-1 p-8 flex flex-col justify-center">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-400/20 flex items-center justify-center text-xl mb-5">🎯</div>
                  <h3 className="text-xl font-semibold mb-3">Interactive Labs</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Hands-on exploration of physics concepts with real-time visualization and instant feedback on every parameter change.
                  </p>
                </div>
                <div className="sm:w-60 flex-shrink-0 flex items-center justify-center p-4">
                  <OrbitalVisual />
                </div>
              </div>
            </motion.div>

            {/* Card B — Real-Time Viz (1/3) */}
            <motion.div
              className="relative rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden group cursor-default"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: 0.08, ease }}
              whileHover={{ y: -4 }}
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(34,211,238,0.12), transparent 65%)' }}
              />
              <WaveVisual />
              <div className="p-6 pt-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-400/20 flex items-center justify-center text-lg mb-4">📊</div>
                <h3 className="text-lg font-semibold mb-2">Real-Time Visualization</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Adjust parameters and watch results change instantly — no refresh, no lag.
                </p>
              </div>
            </motion.div>

            {/* Card C — Always Accessible (1/3) */}
            <motion.div
              className="relative rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden group cursor-default"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: 0.16, ease }}
              whileHover={{ y: -4 }}
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(52,211,153,0.12), transparent 65%)' }}
              />
              <div className="p-6">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-400/20 flex items-center justify-center text-lg mb-5">🌐</div>
                <h3 className="text-lg font-semibold mb-2">Always Accessible</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Web-based, no install required. Works on any device, anywhere.
                </p>
                <div className="flex flex-wrap gap-2 mt-6">
                  {['Desktop', 'Tablet', 'Mobile'].map((d) => (
                    <span key={d} className="px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.07] text-slate-400 text-[0.65rem] font-medium">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Card D — Research-Based (2/3 wide) */}
            <motion.div
              className="md:col-span-2 relative rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden group cursor-default"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: 0.12, ease }}
              whileHover={{ y: -4 }}
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at 35% 100%, rgba(168,85,247,0.1), transparent 65%)' }}
              />
              <div className="flex flex-col sm:flex-row-reverse h-full">
                <div className="flex-1 p-8 flex flex-col justify-center">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-400/20 flex items-center justify-center text-xl mb-5">🔬</div>
                  <h3 className="text-xl font-semibold mb-3">Research-Based Design</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Built by students with educator input to create simulations that are both engaging and educationally effective.
                  </p>
                </div>
                <div className="sm:w-56 flex-shrink-0 flex items-center justify-center p-4">
                  <NetworkVisual />
                </div>
              </div>
            </motion.div>

            {/* Card E — Educator Tools (full width) */}
            <motion.div
              className="md:col-span-3 relative rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01] overflow-hidden group cursor-default"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: 0.2, ease }}
              whileHover={{ y: -2 }}
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(251,191,36,0.06), transparent 70%)' }}
              />
              <div className="p-8 md:p-10 flex flex-col md:flex-row md:items-center gap-8">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-400/20 flex items-center justify-center text-2xl">🎓</div>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">Educator Tools</h3>
                  <p className="text-slate-400 text-sm leading-relaxed max-w-xl">
                    Designed for use in lectures, labs, and assignments. Clean interface minimizes cognitive load and maximizes learning outcomes.
                  </p>
                </div>
                <div className="flex flex-wrap gap-5 flex-shrink-0">
                  {[
                    { label: 'Student-Friendly', icon: '📱' },
                    { label: 'Free Forever', icon: '✨' },
                    { label: 'No Login Required', icon: '🔓' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2 text-sm text-slate-300">
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* CTA Section */}
      <motion.section
        className="relative py-20 px-4"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-3xl mx-auto">
          <div className="relative rounded-3xl border border-white/[0.1] bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-12 text-center overflow-hidden">
            {/* Background glow */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_0%,rgba(56,189,248,0.1),transparent)] pointer-events-none" />

            <motion.div
              className="relative z-10"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Experience our most advanced simulation
              </h2>
              <p className="text-slate-400 text-lg mb-8">
                Explore particle collisions, decay processes, and fundamental forces in the Large Hadron Collider simulation.
              </p>
              <Link
                to="/lhc"
                className="inline-block px-8 py-4 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold hover:shadow-lg hover:shadow-blue-500/40 transition-all duration-200 active:scale-95"
              >
                Launch
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {experimentalMechanicsEnabled ? (
        <motion.section
          className="relative px-4 pb-20"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="mx-auto max-w-4xl">
            <div className="rounded-3xl border border-fuchsia-300/20 bg-fuchsia-950/20 p-5 shadow-2xl shadow-fuchsia-500/10 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-200">Debug Panel</p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-50">Experimental Mechanics</h2>
                </div>
                <span className="rounded-full border border-fuchsia-300/30 bg-fuchsia-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-fuchsia-100">
                  Active
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-400">Theme filter</p>
                  <p className="mt-2 text-sm font-medium text-slate-100">hue-rotate(35deg) saturate(1.3)</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-400">featuredSimPath</p>
                  <p className="mt-2 break-words text-sm font-medium text-slate-100">{featuredSimPath}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-400">maintenanceMode</p>
                  <p className="mt-2 text-sm font-medium text-slate-100">{String(adminControls.featureFlags.maintenanceMode)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-400">showDebugPanel</p>
                  <p className="mt-2 text-sm font-medium text-slate-100">{String(adminControls.featureFlags.showDebugPanel)}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      ) : null}

    </div>
  );
}

export default Home;





{/* // this code is powered by this little guy:

//  ▐▛███▜▌   
//▝▜█████▛▘  
//  ▘▘ ▝▝    */}