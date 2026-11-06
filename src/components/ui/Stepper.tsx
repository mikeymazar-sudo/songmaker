"use client";

import { Minus, Plus } from "lucide-react";
import { cn, fmtNum, round2 } from "@/lib/format";

/** A number with big − / + buttons, sized for thumbs on a tablet in the walk-in. */
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
  hideLabel = false,
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
  /** Keep the label for screen readers but don't show it. */
  hideLabel?: boolean;
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

  const btn = size === "lg" ? "h-12 w-12" : size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const input = size === "lg" ? "h-12 text-xl" : size === "sm" ? "h-9 text-sm" : "h-11 text-base";
  const btnTone =
    tone === "brand"
      ? "bg-brand text-brand-fg hover:bg-brand-hover"
      : "bg-surface text-text hover:bg-surface-3 active:bg-border";

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && !hideLabel ? <span className="text-[13px] font-medium text-muted">{label}</span> : null}
      <div
        className={cn(
          "flex items-stretch overflow-hidden rounded-xl border border-border-strong bg-surface focus-within:border-text focus-within:ring-2 focus-within:ring-ring/25",
        )}
      >
        <button
          type="button"
          aria-label={`Decrease ${label ?? "value"}`}
          className={cn("flex shrink-0 items-center justify-center border-r border-border transition-colors disabled:text-border-strong", btn, btnTone)}
          onClick={() => commit(String(value - step))}
          disabled={value <= min}
        >
          <Minus className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
        </button>
        <div className="relative min-w-0 flex-1">
          <input
            key={value}
            type="number"
            inputMode="decimal"
            defaultValue={value}
            onFocus={(e) => e.target.select()}
            onBlur={(e) => commit(e.target.value, e.target)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className={cn(
              "tabular w-full min-w-10 bg-transparent text-center font-semibold text-text focus:outline-none",
              suffix && "pr-5",
              input,
            )}
            aria-label={label}
          />
          {suffix ? (
            <span className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-[11px] font-medium text-muted">
              {suffix}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={`Increase ${label ?? "value"}`}
          className={cn("flex shrink-0 items-center justify-center border-l border-border transition-colors disabled:text-border-strong", btn, btnTone)}
          onClick={() => commit(String(value + step))}
          disabled={value >= max}
        >
          <Plus className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
        </button>
      </div>
      <span className="sr-only">{fmtNum(value)}</span>
    </div>
  );
}
