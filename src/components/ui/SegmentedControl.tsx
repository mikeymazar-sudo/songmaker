"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/format";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "md",
}: {
  options: Array<{ value: T; label: ReactNode; count?: number }>;
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="tablist"
      className={cn("inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-surface-3 p-1 no-scrollbar", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors",
              size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-3.5 text-sm",
              active ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text",
            )}
          >
            {o.label}
            {o.count !== undefined ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] tabular",
                  active ? "bg-brand-soft text-brand dark:text-text" : "bg-surface-2 text-muted",
                )}
              >
                {o.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
