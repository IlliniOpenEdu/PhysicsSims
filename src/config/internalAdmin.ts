export type AccessRole = 'admin' | 'dev';

export type FeatureFlags = {
  maintenanceMode: boolean;
  experimentalMechanics: boolean;
  analyticsCollection: boolean;
  showDebugPanel: boolean;
};

export type BugTestControls = {
  forceHomeError: boolean;
  simulateSlowNetworkMs: number;
  mockDeployStatus: 'auto' | 'online' | 'issues' | 'deploying';
};

export type ContentOverrides = {
  homeHeroTitle: string;
  homeHeroSubtitle: string;
  homeHeroTagline: string;
  featuredSimPath: string;
};

export type ManagedAnnouncement = {
  enabled: boolean;
  id: string;
  title: string;
  description: string;
  primaryButtonText: string;
  primaryButtonUrl: string;
  openPrimaryInNewTab: boolean;
};

export type AnalyticsEvent = {
  id: string;
  ts: number;
  type: 'page_view' | 'admin_action' | 'login_success' | 'login_failure';
  detail: string;
  payload?: Record<string, unknown>;
};

export type AdminControlState = {
  updatedAt: number;
  featureFlags: FeatureFlags;
  simulationVisibility: Record<string, boolean>;
  contentOverrides: ContentOverrides;
  bugTestControls: BugTestControls;
  announcement: ManagedAnnouncement;
};

export const ADMIN_SESSION_KEY = 'physicssims-admin-session';
export const ADMIN_CONTROLS_KEY = 'physicssims-admin-controls';
export const ANALYTICS_EVENTS_KEY = 'physicssims-analytics-events';

export const DEFAULT_FEATURED_SIM_PATH = '/kinematics-2d';

export const KNOWN_SIM_PATHS = [
  '/kinematics',
  '/kinematics-2d',
  '/forces',
  '/gravity-friction',
  '/box-incline',
  '/spring-force',
  '/pulley-system',
  '/energy-hills',
  '/spring-energy',
  '/work-in-dynamics',
  '/center-of-mass',
  '/impulse-builder',
  '/momentum-collision-1d',
  '/momentum-collision-2d',
  '/columbs-law',
  '/gauss-law',
  '/maxwell',
  '/amperes-law',
  '/faradays-law',
  '/capacitor',
  '/rc-circuit',
  '/mag-field',
  '/lhc',
  '/beam-balance',
  '/distributed-load',
] as const;

const getDefaultSimulationVisibility = (): Record<string, boolean> => {
  const visibilityMap: Record<string, boolean> = {};
  for (const path of KNOWN_SIM_PATHS) {
    visibilityMap[path] = true;
  }
  return visibilityMap;
};

export const createDefaultAdminState = (): AdminControlState => ({
  updatedAt: Date.now(),
  featureFlags: {
    maintenanceMode: false,
    experimentalMechanics: false,
    analyticsCollection: true,
    showDebugPanel: false,
  },
  simulationVisibility: getDefaultSimulationVisibility(),
  contentOverrides: {
    homeHeroTitle: 'Interactive physics, built for understanding.',
    homeHeroSubtitle: 'Interactive labs across Mechanics, E&M, and Statics that make concepts click faster.',
    homeHeroTagline: 'Start with a track or jump into the full collection of simulations.',
    featuredSimPath: DEFAULT_FEATURED_SIM_PATH,
  },
  bugTestControls: {
    forceHomeError: false,
    simulateSlowNetworkMs: 0,
    mockDeployStatus: 'auto',
  },
  announcement: {
    enabled: false,
    id: 'internal-announcement',
    title: 'Internal announcement',
    description: 'This is managed from the admin panel.',
    primaryButtonText: 'Learn more',
    primaryButtonUrl: '#mechanics',
    openPrimaryInNewTab: false,
  },
});

export const isInternalEnvironment = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  const host = window.location.hostname.toLowerCase();
  const allowByHost =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.internal') ||
    host.endsWith('.local');

  const allowByEnv = (import.meta.env.VITE_INTERNAL_ADMIN_ENABLED as string | undefined) === 'true';

  return allowByHost || allowByEnv;
};

export const loadAdminState = (): AdminControlState => {
  if (typeof window === 'undefined') {
    return createDefaultAdminState();
  }

  const fallback = createDefaultAdminState();

  try {
    const raw = window.localStorage.getItem(ADMIN_CONTROLS_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Partial<AdminControlState>;

    return {
      ...fallback,
      ...parsed,
      featureFlags: {
        ...fallback.featureFlags,
        ...(parsed.featureFlags || {}),
      },
      simulationVisibility: {
        ...fallback.simulationVisibility,
        ...(parsed.simulationVisibility || {}),
      },
      contentOverrides: {
        ...fallback.contentOverrides,
        ...(parsed.contentOverrides || {}),
      },
      bugTestControls: {
        ...fallback.bugTestControls,
        ...(parsed.bugTestControls || {}),
      },
      announcement: {
        ...fallback.announcement,
        ...(parsed.announcement || {}),
      },
    };
  } catch {
    return fallback;
  }
};

export const saveAdminState = (nextState: AdminControlState): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      ADMIN_CONTROLS_KEY,
      JSON.stringify({
        ...nextState,
        updatedAt: Date.now(),
      }),
    );
    window.dispatchEvent(new Event('storage'));
  } catch {
    // Ignore localStorage failure in restricted browsers.
  }
};

export const pushAnalyticsEvent = (
  type: AnalyticsEvent['type'],
  detail: string,
  payload?: Record<string, unknown>,
): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const existingRaw = window.localStorage.getItem(ANALYTICS_EVENTS_KEY);
    const existing = existingRaw ? (JSON.parse(existingRaw) as AnalyticsEvent[]) : [];

    const nextEvent: AnalyticsEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      type,
      detail,
      payload,
    };

    const nextEvents = [...existing, nextEvent].slice(-500);
    window.localStorage.setItem(ANALYTICS_EVENTS_KEY, JSON.stringify(nextEvents));
  } catch {
    // Ignore event persistence failure.
  }
};

export const loadAnalyticsEvents = (): AnalyticsEvent[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(ANALYTICS_EVENTS_KEY);
    return raw ? (JSON.parse(raw) as AnalyticsEvent[]) : [];
  } catch {
    return [];
  }
};
