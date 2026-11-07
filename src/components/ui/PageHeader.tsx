import type { ReactNode } from "react";
import { cn } from "@/lib/format";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-text md:text-[32px]">{title}</h1>
        {description ? <p className="mt-1 max-w-xl text-[15px] leading-relaxed text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
