import React from 'react';

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
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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
}: SliderWithInputProps) {
  const percent = ((value - min) / (max - min)) * 100;

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
          onChange={(e) => onChange(Number(e.target.value))}
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
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (!Number.isNaN(next)) onChange(clamp(next, min, max));
            }}
            className={inputClassName}
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