"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/format";

/** Underlined text tabs. They scroll sideways on a phone, edge to edge. */
export function Tabs<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: Array<{ value: T; label: ReactNode; count?: number }>;
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("no-scrollbar -mx-4 flex gap-6 overflow-x-auto border-b border-border px-4 md:mx-0 md:px-0", className)}>
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
              "relative flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap text-[15px] font-medium transition-colors",
              active ? "text-text after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-text" : "text-muted md:hover:text-text",
            )}
          >
            {o.label}
            {o.count ? <span className="tabular text-[13px] font-normal text-muted">{o.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
