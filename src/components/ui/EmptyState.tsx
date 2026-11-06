import type { ReactNode } from "react";
import { cn } from "@/lib/format";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-(--radius-card) border border-dashed border-border-strong bg-surface/60 px-6 py-12 text-center", className)}>
      {icon ? <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-3 text-muted">{icon}</div> : null}
      <div className="text-base font-semibold text-text">{title}</div>
      {description ? <div className="mt-1 max-w-md text-sm text-muted">{description}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
