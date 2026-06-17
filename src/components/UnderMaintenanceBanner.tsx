import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { SVGProps } from "react";

type IconName = "wrench" | "clock" | "sparkles" | "arrow";

type UnderMaintenanceBannerProps = {
  title?: string;
  message?: string;
  statusUrl?: string;
  defaultOpen?: boolean;
  className?: string;
};

function Icon({
  name,
  className = "",
  ...props
}: { name: IconName; className?: string } & SVGProps<SVGSVGElement>) {
  const icons: Record<IconName, JSX.Element> = {
    wrench: (
      <path d="M14.7 6.3a4.8 4.8 0 0 0-5.8 5.8L3 18l3 3 5.9-5.9a4.8 4.8 0 0 0 5.8-5.8l-3.1 3.1-3-3 3.1-3.1Z" />
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l3 2" />
      </>
    ),
    sparkles: (
      <>
        <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z" />
        <path d="M5 15l.8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8L5 15Z" />
        <path d="M19 13l.6 1.4L21 15l-1.4.6L19 17l-.6-1.4L17 15l1.4-.6L19 13Z" />
      </>
    ),
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {icons[name]}
    </svg>
  );
}

export default function UnderMaintenanceBanner({
  title = "We’re tuning things up.",
  message = "This page is temporarily under maintenance while we ship improvements. Everything should be back online shortly.",
  statusUrl = "#",
  defaultOpen = false,
  className = "",
}: UnderMaintenanceBannerProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`relative z-50 inline-block w-fit pointer-events-none ${className}`}>
      <AnimatePresence mode="wait" initial={false}>
        {!isOpen ? (
          <motion.button
            key="maintenance-icon"
            type="button"
            onClick={() => setIsOpen(true)}
            initial={{ opacity: 0, scale: 0.85, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: -8 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.96 }}
            className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-yellow-300/30 bg-slate-950 text-yellow-300 shadow-lg shadow-yellow-500/10 ring-1 ring-white/10 transition hover:bg-slate-900"
            aria-label="Open maintenance notice"
          >
            <motion.span
              animate={{ rotate: [0, -8, 8, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Icon name="wrench" className="h-6 w-6" />
            </motion.span>
          </motion.button>
        ) : (
          <motion.section
            key="maintenance-banner"
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="pointer-events-auto relative overflow-hidden rounded-3xl border border-yellow-400/25 bg-slate-950 px-4 py-5 text-white shadow-2xl shadow-yellow-500/10 sm:px-8 lg:px-10"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.24),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.18),transparent_35%)]" />
            <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-yellow-400/10 blur-3xl" />
            <div className="absolute -bottom-20 left-1/3 h-52 w-52 rounded-full bg-amber-500/10 blur-3xl" />

            <div className="relative grid items-center gap-6 lg:grid-cols-[1fr_auto]">
              <div className="flex gap-5">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-yellow-400/15 ring-1 ring-yellow-300/30 transition hover:bg-yellow-400/20"
                  aria-label="Collapse maintenance notice"
                >
                  <motion.span
                    animate={{ rotate: [0, -8, 8, 0], scale: [1, 1.04, 1] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Icon name="wrench" className="h-7 w-7 text-yellow-300" />
                  </motion.span>
                </button>

                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-yellow-300/20 bg-white/5 px-3 py-1 text-sm text-yellow-100 backdrop-blur">
                    <Icon name="sparkles" className="h-4 w-4" />
                    System update in progress
                  </div>

                  <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    {title}
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                    {message}
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-300">
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-2 ring-1 ring-white/10">
                      <Icon name="clock" className="h-4 w-4 text-yellow-300" />
                      Estimated downtime: short
                    </span>
                    <span className="rounded-full bg-yellow-400/10 px-3 py-2 text-yellow-200 ring-1 ring-yellow-300/20">
                      No action needed
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-white backdrop-blur-xl">
                <div className="mb-4 h-2 w-44 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    initial={{ x: "-100%" }}
                    animate={{ x: "180%" }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                    className="h-full w-20 rounded-full bg-yellow-300"
                  />
                </div>

                <p className="text-sm text-slate-300">Current status</p>
                <p className="mt-1 font-semibold">Maintenance mode</p>

                <a
                  href={statusUrl}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-yellow-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-yellow-200"
                >
                  Check status
                  <Icon name="arrow" className="ml-2 h-4 w-4" />
                </a>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

export function UnderMaintenanceBannerSmokeTest() {
  return (
    <div className="space-y-6 bg-slate-900 p-6">
      <UnderMaintenanceBanner />
      <UnderMaintenanceBanner
        defaultOpen
        title="PhysicsSims is getting upgraded."
        message="We’re pushing a small UI update and cleaning up a few lab pages."
        statusUrl="/status"
      />
    </div>
  );
}
