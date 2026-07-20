"use client";

import { Info, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface NumberConfigFieldProps {
  label: string;
  tooltip: string;
  unit?: string;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

/** One registry-driven knob: slider + numeric input + current value + reset-to-default + tooltip. */
export function NumberConfigField({
  label,
  tooltip,
  unit,
  value,
  defaultValue,
  min,
  max,
  step,
  onChange,
}: NumberConfigFieldProps) {
  const isDefault = value === defaultValue;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-white/[0.02] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-text-secondary">
          <span className="truncate">{label}</span>
          <span title={tooltip}>
            <Info className="size-3 shrink-0 text-text-muted" />
          </span>
        </span>
        <button
          type="button"
          onClick={() => onChange(defaultValue)}
          disabled={isDefault}
          title="Restaurar padrão"
          className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-1.5 py-0.5 text-[10px] text-text-muted transition-colors hover:text-white disabled:opacity-30"
        >
          <RotateCcw className="size-2.5" />
        </button>
      </div>
      <div className="flex items-center gap-2.5">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1.5 flex-1 accent-purple"
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-20 shrink-0 rounded-lg border border-border bg-bg px-2 py-1 text-right text-xs tabular-nums outline-none focus:border-purple/60"
        />
      </div>
      {unit && <span className="text-right text-[10px] text-text-muted">{unit}</span>}
    </div>
  );
}

interface BooleanConfigFieldProps {
  label: string;
  tooltip: string;
  value: boolean;
  defaultValue: boolean;
  onChange: (value: boolean) => void;
}

export function BooleanConfigField({ label, tooltip, value, defaultValue, onChange }: BooleanConfigFieldProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white/[0.02] p-3">
      <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-text-secondary">
        <span className="truncate">{label}</span>
        <span title={tooltip}>
          <Info className="size-3 shrink-0 text-text-muted" />
        </span>
        {value !== defaultValue && (
          <button
            type="button"
            onClick={() => onChange(defaultValue)}
            title="Restaurar padrão"
            className="flex shrink-0 items-center rounded-lg border border-border px-1.5 py-0.5 text-text-muted transition-colors hover:text-white"
          >
            <RotateCcw className="size-2.5" />
          </button>
        )}
      </span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        aria-pressed={value}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
          value ? "border-purple bg-purple/60" : "border-border bg-white/[0.06]"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white transition-transform",
            value ? "translate-x-[22px]" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}
