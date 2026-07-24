import { useEffect } from 'react';
import type { ReactNode } from 'react';

type ConceptBoxItem = {
  title: ReactNode;
  description: ReactNode;
};

type ConceptBoxProps = {
  heading: ReactNode;
  items: ConceptBoxItem[];
  className?: string;
};

const toast = (message: string) =>
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { message } }));

// SVG presentation properties that must be inlined for serialization, since
// Tailwind classes have no stylesheet inside an exported SVG blob.
const SVG_STYLE_PROPS = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-opacity',
  'stroke-width',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'text-anchor',
  'dominant-baseline',
  'visibility',
  'display',
];

const inlineSvgStyles = (source: SVGSVGElement, clone: SVGSVGElement) => {
  const sourceNodes = [source, ...source.querySelectorAll('*')];
  const cloneNodes = [clone, ...clone.querySelectorAll('*')];
  sourceNodes.forEach((node, index) => {
    const target = cloneNodes[index];
    if (!(node instanceof Element) || !(target instanceof Element)) return;
    const computed = window.getComputedStyle(node);
    const css = SVG_STYLE_PROPS.map((prop) => `${prop}:${computed.getPropertyValue(prop)}`).join(
      ';',
    );
    target.setAttribute('style', css);
  });
};

const downloadPng = (blob: Blob) => {
  const slug = window.location.pathname.split('/').filter(Boolean).pop() ?? 'simulation';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `physicssims-${slug}.png`;
  link.click();
  URL.revokeObjectURL(link.href);
  console.log(`Exported PNG: ${link.download} (${blob.size} bytes)`);
};

const visibleArea = (el: Element) => {
  const rect = el.getBoundingClientRect();
  return rect.width * rect.height;
};

const findExportTarget = (): HTMLCanvasElement | SVGSVGElement | null => {
  // Largest rendered canvas wins; falls back to the largest SVG. The size
  // floor filters out icons and badges.
  const pick = <T extends Element>(selector: string): T | null => {
    const candidates = [...document.querySelectorAll<T>(selector)].filter(
      (el) => visibleArea(el) > 10000,
    );
    candidates.sort((a, b) => visibleArea(b) - visibleArea(a));
    return candidates[0] ?? null;
  };
  return pick<HTMLCanvasElement>('canvas') ?? pick<SVGSVGElement>('svg');
};

const exportSvgAsPng = (svg: SVGSVGElement) => {
  const rect = svg.getBoundingClientRect();
  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineSvgStyles(svg, clone);
  clone.setAttribute('width', String(rect.width));
  clone.setAttribute('height', String(rect.height));
  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }

  const svgText = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
  const image = new Image();
  image.onload = () => {
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = rect.width * scale;
    canvas.height = rect.height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      URL.revokeObjectURL(url);
      toast('Export failed');
      return;
    }
    ctx.fillStyle = window.getComputedStyle(document.body).backgroundColor || '#020617';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (blob) {
        downloadPng(blob);
        toast('PNG downloaded');
      } else {
        toast('Export failed');
      }
    }, 'image/png');
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    toast('Export failed');
  };
  image.src = url;
};

const handleExportPng = () => {
  const target = findExportTarget();
  if (!target) {
    toast('Nothing to export on this page');
    return;
  }
  if (target instanceof HTMLCanvasElement) {
    target.toBlob((blob) => {
      if (blob) {
        downloadPng(blob);
        toast('PNG downloaded');
      } else {
        toast('Export failed');
      }
    }, 'image/png');
    return;
  }
  exportSvgAsPng(target);
};

const handleReset = () => {
  // Reload the route without query params: URL-synced sims return to
  // defaults, everything else resets via the fresh mount.
  const params = new URLSearchParams(window.location.search);
  const clean = params.get('clean');
  window.location.assign(window.location.pathname + (clean ? `?clean=${clean}` : ''));
};

const handlePresentation = () => {
  if (document.fullscreenElement) {
    void document.exitFullscreen();
    toast('Presentation mode off');
  } else {
    document.documentElement
      .requestFullscreen()
      .then(() => toast('Presentation mode on'))
      .catch(() => toast('Fullscreen was blocked by the browser'));
  }
};

// Pages can render several ConceptBoxes; refcount so the window listeners are
// registered exactly once while at least one is mounted.
let mountedCount = 0;

function useAppEventListeners() {
  useEffect(() => {
    mountedCount += 1;
    if (mountedCount === 1) {
      window.addEventListener('app:export-png', handleExportPng);
      window.addEventListener('app:reset', handleReset);
      window.addEventListener('app:presentation', handlePresentation);
    }
    return () => {
      mountedCount -= 1;
      if (mountedCount === 0) {
        window.removeEventListener('app:export-png', handleExportPng);
        window.removeEventListener('app:reset', handleReset);
        window.removeEventListener('app:presentation', handlePresentation);
      }
    };
  }, []);
}

export function ConceptBox({ heading, items, className = '' }: ConceptBoxProps) {
  useAppEventListeners();

  return (
    <section
      className={`rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/40 lg:col-span-2 ${className}`.trim()}
    >
      <h2 className="text-sm font-semibold tracking-wide text-sky-300">{heading}</h2>
      <div className="mt-3 grid gap-4 text-sm text-slate-300 md:grid-cols-2">
        {items.map((item) => (
          <div key={String(item.title)} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <p className="font-semibold text-slate-50">{item.title}</p>
            <p className="mt-2 text-xs leading-relaxed">{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
