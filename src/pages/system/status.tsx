import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadAdminState, type AdminControlState } from '../../config/internalAdmin';

type WorkflowRun = {
  status?: string;
  conclusion?: string;
  html_url?: string;
  updated_at?: string;
  run_number?: number;
};

type ApiResponse = {
  workflow_runs?: WorkflowRun[];
};

type Incident = {
  serviceKey: string;
  startTime: number;
  endTime?: number;
  status: 'degraded' | 'down';
  duration?: number;
};

type StatusUi = {
  label: string;
  detail: string;
  dotClass: string;
  toneClass: string;
  badgeClass: string;
};

// Small helper that generates a sample history array for demonstration purposes.
function generateSampleHistory(key: string): ('up' | 'degraded' | 'down')[] {
  // deterministic pseudo-random pattern per key so visuals are stable
  const seed = Array.from(key).reduce((s, c) => s + c.charCodeAt(0), 0);
  const out: ('up' | 'degraded' | 'down')[] = [];
  for (let i = 0; i < 90; i++) {
    const v = (seed * (i + 7)) % 100;
    if (v < 3) out.push('down');
    else if (v < 10) out.push('degraded');
    else out.push('up');
  }
  return out;
}

function UptimeBars({ history, serviceKey, incidents }: { history: ('up' | 'degraded' | 'down')[]; serviceKey: string; incidents: Incident[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });

  const getStatusLabel = (status: 'up' | 'degraded' | 'down') => {
    if (status === 'up') return 'Operational';
    if (status === 'degraded') return 'Partial outage';
    return 'Major outage';
  };

  const getDate = (idx: number) => {
    const now = new Date();
    const daysAgo = history.length - idx - 1;
    const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getDurationString = (seconds?: number) => {
    if (!seconds) return 'Ongoing';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours} hr${hours > 1 ? 's' : ''} ${mins} min${mins !== 1 ? 's' : ''}`;
    return `${mins} min${mins !== 1 ? 's' : ''}`;
  };

  const getIncidentForDay = (idx: number) => {
    const now = new Date();
    const daysAgo = history.length - idx - 1;
    const dayStart = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    return incidents.find((inc) => {
      if (inc.serviceKey !== serviceKey) return false;
      return inc.startTime >= dayStart.getTime() && inc.startTime < dayEnd.getTime();
    });
  };

  return (
    <div className="relative flex items-end gap-0.5 overflow-hidden">
      {history.map((h, idx) => {
        const color = h === 'up' ? 'bg-emerald-400' : h === 'degraded' ? 'bg-amber-400' : 'bg-rose-400';
        const height = h === 'up' ? 28 : h === 'degraded' ? 18 : 10;
        const isHovered = hoveredIdx === idx;
        const incident = getIncidentForDay(idx);

        return (
          <div
            key={idx}
            className="relative"
            onMouseEnter={(e) => {
              setHoveredIdx(idx);
              const rect = e.currentTarget.getBoundingClientRect();
              setPopoverPos({ x: rect.left, y: rect.top - 120 });
            }}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <div
              className={`${color} rounded-sm cursor-pointer transition hover:opacity-80`}
              style={{ width: 4, height }}
              title={`Day ${idx + 1}: ${h}`}
            />

            {isHovered && (
              <div
                className="fixed z-50 rounded-lg border border-white/10 bg-slate-900 p-3 text-xs shadow-lg"
                style={{
                  left: `${popoverPos.x - 80}px`,
                  top: `${popoverPos.y}px`,
                  minWidth: '160px',
                }}
              >
                <p className="font-semibold text-slate-100">{getDate(idx)}</p>
                <p className={`mt-1 flex items-center gap-1 ${
                  h === 'up' ? 'text-emerald-300' : h === 'degraded' ? 'text-amber-300' : 'text-rose-300'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    h === 'up' ? 'bg-emerald-400' : h === 'degraded' ? 'bg-amber-400' : 'bg-rose-400'
                  }`} />
                  {getStatusLabel(h)}
                </p>
                {incident && (
                  <p className="mt-2 text-slate-300">
                    {getDurationString(incident.duration)}
                  </p>
                )}
                {h === 'up' && !incident && (
                  <p className="mt-2 text-slate-400">No downtime recorded</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

async function checkServiceHealth(url: string, signal?: AbortSignal): Promise<'up' | 'degraded' | 'down'> {
  try {
    const response = await fetch(url, { method: 'GET', signal, cache: 'no-store' });
    if (response.ok || response.status === 404) return 'up';
    if (response.status >= 500) return 'degraded';
    return 'down';
  } catch (err: unknown) {
    // CORS error means the service is likely up, just not accessible from browser
    const error = err as Error;
    if (error?.message?.includes('CORS') || error?.message?.includes('cross-origin')) {
      return 'up';
    }
    return 'down';
  }
}

const DEPLOY_STATUS_API =
  'https://api.github.com/repos/IlliniOpenEdu/PhysicsSims/actions/workflows/deploy.yml/runs?per_page=1';

const LOADING_UI: StatusUi = {
  label: 'Checking',
  detail: 'Loading latest deploy run...',
  dotClass: 'bg-amber-300',
  toneClass: 'text-amber-200',
  badgeClass: 'bg-amber-400/15 border-amber-300/35',
};

const ERROR_UI: StatusUi = {
  label: 'Unavailable',
  detail: 'Could not fetch deploy status',
  dotClass: 'bg-slate-400',
  toneClass: 'text-slate-200',
  badgeClass: 'bg-slate-400/15 border-slate-300/35',
};

function mapStatus(status?: string, conclusion?: string): StatusUi {
  if (status === 'completed') {
    if (conclusion === 'success') {
      return {
        label: 'Online',
        detail: 'Latest deploy completed successfully.',
        dotClass: 'bg-emerald-400',
        toneClass: 'text-emerald-200',
        badgeClass: 'bg-emerald-400/15 border-emerald-300/35',
      };
    }
    if (conclusion === 'failure' || conclusion === 'timed_out') {
      return {
        label: 'Issues',
        detail: 'Latest deploy failed or timed out.',
        dotClass: 'bg-rose-400',
        toneClass: 'text-rose-200',
        badgeClass: 'bg-rose-400/15 border-rose-300/35',
      };
    }
    if (conclusion === 'cancelled' || conclusion === 'skipped') {
      return {
        label: 'Paused',
        detail: 'Latest deploy did not complete normally.',
        dotClass: 'bg-amber-300',
        toneClass: 'text-amber-200',
        badgeClass: 'bg-amber-400/15 border-amber-300/35',
      };
    }
  }

  if (status === 'queued') {
    return {
      label: 'Queued',
      detail: 'Deploy run is queued.',
      dotClass: 'bg-amber-300',
      toneClass: 'text-amber-200',
      badgeClass: 'bg-amber-400/15 border-amber-300/35',
    };
  }

  if (status === 'in_progress' || status === 'waiting' || status === 'requested') {
    return {
      label: 'Deploying',
      detail: 'A deploy is currently running.',
      dotClass: 'bg-sky-300',
      toneClass: 'text-sky-200',
      badgeClass: 'bg-sky-400/15 border-sky-300/35',
    };
  }

  return ERROR_UI;
}

export function System() {
  const [ui, setUi] = useState<StatusUi>(LOADING_UI);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [runNumber, setRunNumber] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [adminControls, setAdminControls] = useState<AdminControlState>(loadAdminState);
  const [historyMap, setHistoryMap] = useState<Record<string, ('up' | 'degraded' | 'down')[]>>({});
  const [incidents, setIncidents] = useState<Incident[]>(() => {
    try {
      const stored = localStorage.getItem('serviceIncidents');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [prevStatuses, setPrevStatuses] = useState<Record<string, 'up' | 'degraded' | 'down'>>({});

  const refresh = async (signal?: AbortSignal) => {
    setIsRefreshing(true);

    try {
      const simulatedDelay = Math.max(0, adminControls.bugTestControls.simulateSlowNetworkMs || 0);
      if (simulatedDelay > 0) {
        await new Promise((resolve) => {
          window.setTimeout(resolve, simulatedDelay);
        });
      }

      if (signal?.aborted) {
        return;
      }

      const mockStatus = adminControls.bugTestControls.mockDeployStatus;
      if (mockStatus !== 'auto') {
        if (mockStatus === 'online') {
          setUi(mapStatus('completed', 'success'));
        } else if (mockStatus === 'issues') {
          setUi(mapStatus('completed', 'failure'));
        } else if (mockStatus === 'deploying') {
          setUi(mapStatus('in_progress'));
        } else if (mockStatus === 'paused') {
          setUi(mapStatus('completed', 'cancelled'));
        } else if (mockStatus === 'queued') {
          setUi(mapStatus('queued'));
        }

        setUpdatedAt(new Date().toISOString());
        setRunNumber(null);
          // still attempt to load history when using mock mode
          void loadHistory(signal);
        return;
      }

      const response = await fetch(DEPLOY_STATUS_API, {
        signal,
        headers: { Accept: 'application/vnd.github+json' },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`GitHub status fetch failed: ${response.status}`);
      }

      const data = (await response.json()) as ApiResponse;
      const latest = data.workflow_runs?.[0];

      if (!latest) {
        setUi(ERROR_UI);
        return;
      }

      setUi(mapStatus(latest.status, latest.conclusion));
      setUpdatedAt(latest.updated_at ?? null);
      setRunNumber(latest.run_number ?? null);
      // after updating UI status, load historical uptime data
      void loadHistory(signal);
    } catch {
      if (!signal?.aborted) {
        setUi(ERROR_UI);
      }
    } finally {
      if (!signal?.aborted) {
        setIsRefreshing(false);
      }
    }
  };

  async function loadHistory(signal?: AbortSignal) {
    const serviceKeys = ['web', 'routes', 'deploy', 'wiki'];
    try {
      const GH_URL = 'https://api.github.com/repos/IlliniOpenEdu/PhysicsSims/actions/workflows/deploy.yml/runs?per_page=90';
      const resp = await fetch(GH_URL, { signal, headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
      if (resp.ok) {
        const json = await resp.json();
        const runs: WorkflowRun[] = json.workflow_runs ?? [];
        const recent = runs.slice(0, 90).reverse();
        const deployHistory: ('up' | 'degraded' | 'down')[] = recent.map((r) => {
          const c = r.conclusion;
          if (c === 'success') return 'up';
          if (c === 'failure' || c === 'timed_out') return 'down';
          if (c === 'cancelled' || c === 'skipped') return 'degraded';
          return 'degraded';
        });

        // Check current health of Web App, Simulation Routes, and Wiki
        const [webStatus, routesStatus, wikiStatus] = await Promise.all([
          checkServiceHealth('https://physicssims.illiniopenedu.org/', signal),
          checkServiceHealth('https://physicssims.illiniopenedu.org/dashboard', signal),
          checkServiceHealth('https://github.com/IlliniOpenEdu/PhysicsSims/wiki', signal),
        ]);

        // Retrieve or initialize stored history
        const storedHistory: Record<string, ('up' | 'degraded' | 'down')[]> = (() => {
          try {
            const stored = localStorage.getItem('serviceHealthHistory');
            return stored ? JSON.parse(stored) : {};
          } catch {
            return {};
          }
        })();

        // For each service, shift current status onto the history (keep last 90)
        const map: Record<string, ('up' | 'degraded' | 'down')[]> = {};
        const newHistory: Record<string, ('up' | 'degraded' | 'down')[]> = {};

        for (const k of serviceKeys) {
          let hist = storedHistory[k] ?? [];
          if (hist.length > 89) hist = hist.slice(1);
          newHistory[k] = hist;
        }

        newHistory.web = [...newHistory.web, webStatus];
        newHistory.routes = [...newHistory.routes, routesStatus];
        newHistory.wiki = [...newHistory.wiki, wikiStatus];
        newHistory.deploy = deployHistory;

        // Detect incidents (transitions from up to degraded/down, or back to up)
        const currentStatuses = { web: webStatus, routes: routesStatus, wiki: wikiStatus, deploy: deployHistory[deployHistory.length - 1] };
        const newIncidents = [...incidents];
        const now = Date.now();

        for (const k of serviceKeys) {
          const current = currentStatuses[k as keyof typeof currentStatuses];
          const prev = prevStatuses[k];

          if (prev && prev !== current) {
            // Status changed
            if (prev === 'up' && (current === 'degraded' || current === 'down')) {
              // Started incident
              newIncidents.push({ serviceKey: k, startTime: now, status: current });
            } else if (prev !== 'up' && current === 'up') {
              // Ended incident
              const activeIncident = newIncidents.find((inc) => inc.serviceKey === k && !inc.endTime);
              if (activeIncident) {
                activeIncident.endTime = now;
                activeIncident.duration = (now - activeIncident.startTime) / 1000; // seconds
              }
            }
          }
        }

        // Update previous statuses for next call
        setPrevStatuses(currentStatuses as Record<string, 'up' | 'degraded' | 'down'>);

        // Store updated history and incidents
        try {
          localStorage.setItem('serviceHealthHistory', JSON.stringify(newHistory));
          localStorage.setItem('serviceIncidents', JSON.stringify(newIncidents));
        } catch {
          // ignore storage errors
        }
        setIncidents(newIncidents);

        map.web = newHistory.web.length > 0 ? newHistory.web : generateSampleHistory('web');
        map.routes = newHistory.routes.length > 0 ? newHistory.routes : generateSampleHistory('routes');
        map.wiki = newHistory.wiki.length > 0 ? newHistory.wiki : generateSampleHistory('wiki');
        map.deploy = deployHistory;
        setHistoryMap(map);
        return;
      }
    } catch {
      // fall through to sample fallback
    }

    const map: Record<string, ('up' | 'degraded' | 'down')[]> = {};
    for (const k of serviceKeys) map[k] = generateSampleHistory(k);
    setHistoryMap(map);
  }

  useEffect(() => {
    const onStorageUpdated = () => {
      setAdminControls(loadAdminState());
    };

    window.addEventListener('storage', onStorageUpdated);
    return () => {
      window.removeEventListener('storage', onStorageUpdated);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [adminControls.bugTestControls.mockDeployStatus, adminControls.bugTestControls.simulateSlowNetworkMs]);

  const updatedText = useMemo(() => {
    if (!updatedAt) return 'Unknown';
    return new Date(updatedAt).toLocaleString();
  }, [updatedAt]);

  const generatedAt = useMemo(() => new Date().toLocaleTimeString(), [updatedAt]);

  return (
    <div className="min-h-screen bg-[#05080d] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_40%_at_50%_-10%,rgba(56,189,248,0.12),transparent)]" />

      <div className="relative mx-auto w-full max-w-6xl px-4 py-12">
        <div className="mb-10 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-sky-300/70">Platform Operations</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">System Status</h1>
            <p className="mt-2 text-sm text-slate-400">Live deployment and availability snapshot for PhysicsSims services.</p>
          </div>
          <Link
            to="/dashboard"
            className="rounded-lg border border-white/15 bg-white/[0.02] px-3 py-2 text-sm text-slate-200 transition hover:border-sky-300/70 hover:text-sky-200"
          >
            Back to Dashboard
          </Link>
        </div>

        <section className="rounded-2xl border border-white/10 bg-[#0d1118]/90 p-6 shadow-xl shadow-slate-950/40">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex items-center gap-3">
              <span className={`h-2.5 w-2.5 rounded-full ${ui.dotClass}`} aria-hidden="true" />
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${ui.badgeClass} ${ui.toneClass}`}>
                {ui.label}
              </span>
              <span className="text-sm text-slate-400">{ui.detail}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  void refresh();
                }}
                disabled={isRefreshing}
                className="rounded-md border border-white/15 px-3 py-1.5 text-sm text-slate-200 transition hover:border-sky-300/70 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-[#111722] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Current State</p>
              <p className={`mt-2 text-sm font-semibold ${ui.toneClass}`}>{ui.label}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#111722] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Latest Deploy Run</p>
              <p className="mt-2 text-sm text-slate-200">{runNumber ? `#${runNumber}` : 'Unknown'}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#111722] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Updated</p>
              <p className="mt-2 text-sm text-slate-200">{updatedText}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#111722] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Snapshot Generated</p>
              <p className="mt-2 text-sm text-slate-200">{generatedAt}</p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-white/10 bg-[#0b1017] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Service Components</p>
            <div className="mt-3 space-y-2 text-sm">
              {/* Render a compact historical uptime bar row for each service */}
              {(
                [
                  { key: 'web', name: 'Public Web App' },
                  { key: 'routes', name: 'Simulation Routes' },
                  { key: 'deploy', name: 'Deploy Pipeline' },
                  { key: 'wiki', name: 'Wiki' },
                ] as const
              ).map((svc) => (
                <div key={svc.key} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                  <span className="text-slate-300 mr-4 w-44">{svc.name}</span>
                  <div className="flex-1">
                    <UptimeBars history={historyMap[svc.key] ?? generateSampleHistory(svc.key)} serviceKey={svc.key} incidents={incidents} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
