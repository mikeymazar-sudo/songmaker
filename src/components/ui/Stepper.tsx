"use client";

import { Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { cn, round2 } from "@/lib/format";

/** − number +, with round buttons big enough for a thumb in the walk-in. The number can also be typed. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99999,
  step = 1,
  label,
  className,
  alert,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Read by screen readers; the screen shows it elsewhere. */
  label: string;
  className?: string;
  /** Shows the number in red, for items that have run out. */
  alert?: boolean;
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
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border-strong text-text transition-colors active:bg-surface-3 disabled:opacity-30 md:hover:bg-surface-2";

  return (
    <div className={cn("flex shrink-0 items-center", className)}>
      <button type="button" aria-label={`Decrease ${label}`} className={btn} onClick={() => commit(String(value - step))} disabled={value <= min}>
        <Minus className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </button>
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
          "tabular h-11 w-12 bg-transparent text-center text-lg font-semibold focus:outline-none",
          alert ? "text-danger" : "text-text",
        )}
        aria-label={label}
      />
      <button type="button" aria-label={`Increase ${label}`} className={btn} onClick={() => commit(String(value + step))} disabled={value >= max}>
        <Plus className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </button>
    </div>
  );
}

/** A labelled stepper on one line, for sheets. */
export function StepperRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: ReactNode;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className="text-[15px] font-medium text-text">{label}</div>
        {hint ? <div className="mt-0.5 text-[13px] leading-snug text-muted">{hint}</div> : null}
      </div>
      <Stepper label={label} value={value} onChange={onChange} />
    </div>
  );
}
