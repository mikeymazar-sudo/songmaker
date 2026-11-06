import type { ReactNode } from "react";
import { cn } from "@/lib/format";

export function KpiTile({
  label,
  value,
  hint,
  icon,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "brand";
  className?: string;
}) {
  const valueTone = {
    default: "text-text",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
    brand: "text-brand dark:text-accent",
  }[tone];
  return (
    <div className={cn("rounded-(--radius-card) border border-border bg-surface px-4 py-3.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
        {icon ? <div className="text-muted">{icon}</div> : null}
      </div>
      <div className={cn("tabular mt-1 text-2xl font-semibold leading-tight", valueTone)}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}
