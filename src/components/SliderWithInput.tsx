import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

type SliderWithInputProps = {
  label: React.ReactNode;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  units?: string;
  description?: string;
  accentClass?: string;
  inputClassName?: string;
  queryKey?: string;
  syncToUrl?: boolean;
  disabled?: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatValueForInput(n: number, step: number) {
  if (!Number.isFinite(n)) return '';
  const s = String(step);
  const decimals = s.includes('.') ? s.replace(/^\d*\./, '').length : 0;
  if (decimals > 0) return n.toFixed(Math.min(decimals, 6)).replace(/\.?0+$/, '') || '0';
  return String(Math.round(n));
}

function toQueryKey(label: React.ReactNode): string | null {
  if (typeof label !== 'string') return null;

  const normalized = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized.length > 0 ? normalized : null;
}

export function SliderWithInput({
  label,
  min,
  max,
  step,
  value,
  onChange,
  units,
  description,
  accentClass = 'accent-sky-400',
  inputClassName = 'w-20 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-right text-xs text-slate-100 outline-none',
  queryKey,
  syncToUrl = true,
  disabled = false,
}: SliderWithInputProps) {
  const [params, setParams] = useSearchParams();
  const didHydrateRef = useRef(false);
  const skipNextWriteRef = useRef(false);
  const userEditedRef = useRef(false);
  const lastSeenRawRef = useRef<string | null>(null);
  const [numberFocused, setNumberFocused] = useState(false);
  const [numberDraft, setNumberDraft] = useState('');

  const percent = ((value - min) / (max - min)) * 100;
  const resolvedQueryKey = useMemo(() => queryKey ?? toQueryKey(label), [label, queryKey]);

  useLayoutEffect(() => {
    if (!syncToUrl || resolvedQueryKey == null) return;

    const raw = params.get(resolvedQueryKey);

    if (!didHydrateRef.current) {
      didHydrateRef.current = true;
      lastSeenRawRef.current = raw;

      if (raw == null) return;

      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return;

      const next = clamp(parsed, min, max);
      if (!Object.is(next, value)) {
        skipNextWriteRef.current = true;
        onChange(next);
      }
      return;
    }

    if (raw === lastSeenRawRef.current) {
      return;
    }

    lastSeenRawRef.current = raw;
    if (raw == null) return;

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;

    const next = clamp(parsed, min, max);
    if (!Object.is(next, value)) {
      skipNextWriteRef.current = true;
      onChange(next);
    }
  }, [max, min, onChange, params, resolvedQueryKey, syncToUrl, value]);

  useEffect(() => {
    if (!syncToUrl || resolvedQueryKey == null) return;
    if (!didHydrateRef.current) return;
    if (!userEditedRef.current) return;

    if (skipNextWriteRef.current) {
      skipNextWriteRef.current = false;
      return;
    }

    const serialized = String(value);
    if (params.get(resolvedQueryKey) === serialized) return;

    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set(resolvedQueryKey, serialized);
        return next;
      },
      { replace: true }
    );
  }, [params, resolvedQueryKey, setParams, syncToUrl, value]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-slate-200 text-xs">{label}</p>
        {units && (
          <span className="text-[0.7rem] text-slate-400">
            {value.toFixed(2)} {units}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            if (disabled) return;
            userEditedRef.current = true;
            onChange(Number(e.target.value));
          }}
          disabled={disabled}
          style={{
            background: `linear-gradient(to right, #38bdf8 ${percent}%, #1e293b ${percent}%)`,
          }}
          className={`h-1 flex-1 cursor-pointer appearance-none rounded-full bg-slate-800 disabled:cursor-not-allowed ${accentClass}
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:h-3
            [&::-webkit-slider-thumb]:w-3
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-sky-400
            [&::-moz-range-thumb]:h-3
            [&::-moz-range-thumb]:w-3
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-sky-400`}
        />

        <div className="flex items-center gap-1">
          <input
            type="text"
            inputMode="decimal"
            aria-label={typeof label === 'string' ? label : 'Value'}
            value={numberFocused ? numberDraft : formatValueForInput(value, step)}
            onFocus={() => {
              if (disabled) return;
              setNumberFocused(true);
              setNumberDraft(formatValueForInput(value, step));
            }}
            onChange={(e) => {
              if (disabled) return;
              setNumberDraft(e.target.value);
            }}
            onBlur={() => {
              if (disabled) return;
              setNumberFocused(false);
              const raw = numberDraft.trim();
              if (raw === '' || raw === '-' || raw === '.' || raw === '-.') {
                userEditedRef.current = true;
                onChange(clamp(value, min, max));
                return;
              }
              const next = Number(raw);
              if (!Number.isFinite(next)) {
                userEditedRef.current = true;
                onChange(clamp(value, min, max));
                return;
              }
              userEditedRef.current = true;
              onChange(clamp(next, min, max));
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.currentTarget.blur();
            }}
            disabled={disabled}
            className={`${inputClassName} disabled:cursor-not-allowed`}
          />
          {units && <span className="text-[0.65rem] text-slate-400">{units}</span>}
        </div>
      </div>

      {description && (
        <p className="text-[0.65rem] text-slate-500">{description}</p>
      )}
    </div>
  );
}