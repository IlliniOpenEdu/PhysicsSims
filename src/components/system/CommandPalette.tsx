import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { NavigateFunction } from 'react-router-dom';
import { toggleTheme } from '../../utils/theme';

const OPEN_EVENT = 'app:command-palette';
const TOAST_EVENT = 'app:toast';

export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

const emitAppEvent = (name: string, detail?: unknown) => {
  window.dispatchEvent(new CustomEvent(name, { detail }));
};

const toast = (message: string) => emitAppEvent(TOAST_EVENT, { message });

type CommandType = 'Navigate' | 'Action';

interface Command {
  id: string;
  title: string;
  subtitle: string;
  type: CommandType;
  keywords: string[];
  perform: (navigate: NavigateFunction) => void;
}

const COMMANDS: Command[] = [
  {
    id: 'export-png',
    title: 'Export PNG',
    subtitle: 'Save the current simulation view as an image',
    type: 'Action',
    keywords: ['screenshot', 'image', 'download', 'save', 'capture'],
    perform: () => {
      emitAppEvent('app:export-png');
      toast('Export PNG requested');
    },
  },
  {
    id: 'copy-share-link',
    title: 'Copy Share Link',
    subtitle: 'Copy the current URL to the clipboard',
    type: 'Action',
    keywords: ['url', 'clipboard', 'share', 'permalink'],
    perform: () => {
      navigator.clipboard
        .writeText(window.location.href)
        .then(() => toast('Link copied to clipboard'))
        .catch(() => toast('Could not copy link'));
    },
  },
  {
    id: 'reset-simulation',
    title: 'Reset Simulation',
    subtitle: 'Restore the current simulation to defaults',
    type: 'Action',
    keywords: ['restart', 'clear', 'defaults', 'restore'],
    perform: () => {
      emitAppEvent('app:reset');
    },
  },
  {
    id: 'presentation-mode',
    title: 'Presentation Mode',
    subtitle: 'Fullscreen the page for lecture display',
    type: 'Action',
    keywords: ['lecture', 'fullscreen', 'projector', 'present', 'display'],
    perform: () => {
      emitAppEvent('app:presentation');
    },
  },
  {
    id: 'toggle-theme',
    title: 'Toggle Theme',
    subtitle: 'Switch between dark and light UI',
    type: 'Action',
    keywords: ['dark', 'light', 'mode', 'appearance'],
    perform: () => {
      toast(`Theme: ${toggleTheme()}`);
    },
  },
];

const isSubsequence = (needle: string, haystack: string): boolean => {
  let i = 0;
  for (const ch of haystack) {
    if (ch === needle[i]) i += 1;
    if (i >= needle.length) return true;
  }
  return needle.length === 0;
};

const scoreCommand = (command: Command, query: string): number => {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 1;

  const title = command.title.toLowerCase();
  const subtitle = command.subtitle.toLowerCase();
  const type = command.type.toLowerCase();
  const keywords = command.keywords.map((k) => k.toLowerCase());

  let total = 0;
  for (const token of tokens) {
    let best = 0;
    const titleIndex = title.indexOf(token);
    if (titleIndex >= 0) {
      best = Math.max(best, 100 - titleIndex);
    }
    if (subtitle.includes(token)) best = Math.max(best, 50);
    if (keywords.some((k) => k.includes(token))) best = Math.max(best, 40);
    if (type.includes(token)) best = Math.max(best, 20);
    if (best === 0 && isSubsequence(token, title)) best = 10;

    if (best === 0) return 0;
    total += best;
  }
  return total;
};

function Toast() {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string } | string>).detail;
      const text = typeof detail === 'string' ? detail : detail?.message;
      if (!text) return;
      setMessage(text);
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setMessage(null), 2500);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      window.clearTimeout(timerRef.current);
    };
  }, []);

  if (!message) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4">
      <div className="rounded-lg border border-white/10 bg-slate-900/95 px-4 py-2 text-sm text-slate-100 shadow-xl shadow-slate-950/70 backdrop-blur-md">
        {message}
      </div>
    </div>
  );
}

export function CommandPaletteButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      className={`inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[0.78rem] font-medium text-slate-300 transition hover:border-cyan-300/50 hover:text-cyan-200 ${className ?? ''}`}
      aria-label="Open command palette (Ctrl+K)"
    >
      <span>Command Palette</span>
      <span className="flex items-center gap-0.5 text-[0.65rem] text-slate-400">
        <kbd className="rounded border border-white/10 bg-slate-800 px-1 py-0.5 font-sans leading-none">
          Ctrl
        </kbd>
        <kbd className="rounded border border-white/10 bg-slate-800 px-1 py-0.5 font-sans leading-none">
          K
        </kbd>
      </span>
    </button>
  );
}

export function CommandPalette() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    return COMMANDS.map((command) => ({ command, score: scoreCommand(command, query) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.command);
  }, [query]);

  const open = useCallback(() => {
    setQuery('');
    setSelectedIndex(0);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const run = useCallback(
    (command: Command) => {
      setIsOpen(false);
      command.perform(navigate);
    },
    [navigate],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsOpen((prev) => {
          if (!prev) {
            setQuery('');
            setSelectedIndex(0);
          }
          return !prev;
        });
      }
    };
    const onOpenEvent = () => open();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(OPEN_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(OPEN_EVENT, onOpenEvent);
    };
  }, [open]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const selected = listRef.current?.querySelector<HTMLElement>('[data-selected="true"]');
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, results]);

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => (results.length === 0 ? 0 : (prev + 1) % results.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) =>
        results.length === 0 ? 0 : (prev - 1 + results.length) % results.length,
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const command = results[selectedIndex];
      if (command) run(command);
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/70 p-4 pt-[12vh] backdrop-blur-sm"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <div
            className="mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl shadow-slate-950/80 backdrop-blur-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-white/10 px-4">
              <span aria-hidden="true" className="text-sm text-slate-500">
                ⌘
              </span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Search commands…"
                className="w-full bg-transparent py-3.5 text-sm text-slate-100 placeholder-slate-500 outline-none"
                role="combobox"
                aria-expanded="true"
                aria-controls="command-palette-list"
                aria-activedescendant={
                  results[selectedIndex] ? `command-${results[selectedIndex].id}` : undefined
                }
              />
              <kbd className="rounded border border-white/10 bg-slate-800 px-1.5 py-0.5 text-[0.65rem] text-slate-400">
                Esc
              </kbd>
            </div>

            {results.length > 0 ? (
              <ul
                ref={listRef}
                id="command-palette-list"
                role="listbox"
                className="max-h-[50vh] overflow-y-auto p-1.5"
              >
                {results.map((command, index) => {
                  const selected = index === selectedIndex;
                  return (
                    <li
                      key={command.id}
                      id={`command-${command.id}`}
                      role="option"
                      aria-selected={selected}
                      data-selected={selected}
                      onMouseMove={() => setSelectedIndex(index)}
                      onClick={() => run(command)}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                        selected ? 'bg-cyan-300/15 text-cyan-100' : 'text-slate-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{command.title}</p>
                        <p
                          className={`truncate text-xs ${
                            selected ? 'text-cyan-200/70' : 'text-slate-500'
                          }`}
                        >
                          {command.subtitle}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] uppercase tracking-wider ${
                          selected
                            ? 'border-cyan-300/40 text-cyan-200'
                            : 'border-white/10 text-slate-500'
                        }`}
                      >
                        {command.type}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="px-4 py-10 text-center text-sm text-slate-500">
                No commands match “{query}”
              </div>
            )}

            <div className="flex items-center gap-3 border-t border-white/10 px-4 py-2 text-[0.68rem] text-slate-500">
              <span>↑↓ navigate</span>
              <span>↵ run</span>
              <span>esc close</span>
            </div>
          </div>
        </div>
      )}
      <Toast />
    </>
  );
}
