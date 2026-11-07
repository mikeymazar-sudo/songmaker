import type { ReactNode } from "react";
import { cn } from "@/lib/format";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      <div className="text-[17px] font-semibold text-text">{title}</div>
      {description ? <div className="mt-1 max-w-sm text-[15px] text-muted">{description}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
