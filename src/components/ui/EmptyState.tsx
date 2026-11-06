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
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong px-6 py-10 text-center", className)}>
      {icon ? <div className="mb-3 text-muted">{icon}</div> : null}
      <div className="text-base font-semibold text-text">{title}</div>
      {description ? <div className="mt-1 max-w-md text-sm text-muted">{description}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
