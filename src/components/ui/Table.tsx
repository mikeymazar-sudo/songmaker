import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/format";

export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("overflow-x-auto rounded-xl border border-border", className)}>{children}</div>;
}

export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full min-w-max border-collapse text-sm", className)} {...rest} />;
}

export function Th({ className, align, ...rest }: ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }) {
  return (
    <th
      className={cn(
        "sticky top-0 z-10 whitespace-nowrap border-b border-border bg-surface-2 px-3 py-2.5 text-[13px] font-medium text-muted first:pl-5 last:pr-5",
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
        className,
      )}
      {...rest}
    />
  );
}

export function Td({ className, align, ...rest }: TdHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }) {
  return (
    <td
      className={cn(
        "border-b border-border px-3 py-3 align-middle text-text first:pl-5 last:pr-5",
        align === "right" ? "tabular text-right" : align === "center" ? "text-center" : "text-left",
        className,
      )}
      {...rest}
    />
  );
}
