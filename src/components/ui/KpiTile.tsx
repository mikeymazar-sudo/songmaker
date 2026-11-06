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
    brand: "text-text",
  }[tone];
  return (
    <div className={cn("rounded-(--radius-card) border border-border bg-surface px-4 py-4 sm:px-5", className)}>
      <div className="flex items-center gap-2">
        {icon ? <div className="text-muted">{icon}</div> : null}
        <div className="text-sm font-medium text-text-2">{label}</div>
      </div>
      <div className={cn("tabular mt-2 text-[26px] font-semibold leading-none tracking-tight sm:text-[28px]", valueTone)}>{value}</div>
      {hint ? <div className="mt-2 text-[13px] leading-snug text-muted">{hint}</div> : null}
    </div>
  );
}
