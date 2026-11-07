import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/format";

export function List({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn("divide-y divide-border", className)}>{children}</ul>;
}

export function Section({
  title,
  action,
  children,
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mt-10", className)}>
      <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2.5">
        <h2 className="text-[15px] font-semibold text-text">{title}</h2>
        {action ? <div className="shrink-0 text-sm font-medium text-muted">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** One line of a list: what it is on the left, the figure on the right. Links and buttons get a chevron. */
export function Row({
  title,
  subtitle,
  value,
  detail,
  href,
  onClick,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  detail?: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const interactive = Boolean(href || onClick);
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium leading-snug text-text">{title}</div>
        {subtitle ? <div className="mt-0.5 text-[13px] leading-snug text-muted">{subtitle}</div> : null}
      </div>
      {value !== undefined || detail !== undefined ? (
        <div className="shrink-0 text-right">
          {value !== undefined ? <div className="tabular text-[15px] font-medium text-text">{value}</div> : null}
          {detail !== undefined ? <div className="tabular mt-0.5 text-[13px] text-muted">{detail}</div> : null}
        </div>
      ) : null}
      {interactive ? <ChevronRight className="h-4 w-4 shrink-0 text-border-strong" /> : null}
    </>
  );
  const shared = cn(
    "flex min-h-14 w-full items-center gap-3 py-3 text-left",
    interactive && "transition-opacity active:opacity-60 md:hover:opacity-70",
    className,
  );
  if (href) {
    return (
      <Link href={href} className={shared}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={shared}>
        {body}
      </button>
    );
  }
  return <div className={shared}>{body}</div>;
}
