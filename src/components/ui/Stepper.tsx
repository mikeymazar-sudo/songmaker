"use client";

import { Minus, Plus } from "lucide-react";
import { cn, fmtNum, round2 } from "@/lib/format";

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99999,
  step = 1,
  label,
  suffix,
  size = "md",
  className,
  tone = "default",
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  suffix?: string;
  size?: "md" | "lg" | "sm";
  className?: string;
  tone?: "default" | "brand";
}) {
  const commit = (raw: string, input?: HTMLInputElement) => {
    const n = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(n)) {
      if (input) input.value = String(value);
      return;
    }
    const clamped = Math.min(max, Math.max(min, round2(n)));
    if (clamped !== value) onChange(clamped);
    else if (input) input.value = String(value);
  };

  const btn =
    size === "lg"
      ? "h-12 w-12 rounded-xl"
      : size === "sm"
        ? "h-9 w-9 rounded-lg"
        : "h-11 w-11 rounded-xl";
  const input = size === "lg" ? "h-12 text-xl" : size === "sm" ? "h-9 text-sm" : "h-11 text-base";
  const btnTone =
    tone === "brand"
      ? "bg-brand text-brand-fg hover:bg-brand-hover"
      : "bg-surface-3 text-text hover:bg-border-strong/40";

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label ? <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span> : null}
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Decrease ${label ?? "value"}`}
          className={cn("flex shrink-0 items-center justify-center transition-colors active:scale-95", btn, btnTone)}
          onClick={() => commit(String(value - step))}
          disabled={value <= min}
        >
          <Minus className="h-5 w-5" />
        </button>
        <div className="relative min-w-0 flex-1">
          <input
            key={value}
            type="number"
            inputMode="decimal"
            defaultValue={value}
            onBlur={(e) => commit(e.target.value, e.target)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className={cn(
              "tabular w-full rounded-xl border border-border bg-surface text-center font-semibold text-text focus:border-accent focus:outline-none",
              input,
            )}
            aria-label={label}
          />
          {suffix ? (
            <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted">
              {suffix}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={`Increase ${label ?? "value"}`}
          className={cn("flex shrink-0 items-center justify-center transition-colors active:scale-95", btn, btnTone)}
          onClick={() => commit(String(value + step))}
          disabled={value >= max}
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
      <span className="sr-only">{fmtNum(value)}</span>
    </div>
  );
}
