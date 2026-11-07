import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/format";

export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-collapse text-sm", className)} {...rest} />;
}

export function Th({ className, align, ...rest }: ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }) {
  return (
    <th
      className={cn(
        "whitespace-nowrap border-b border-border px-3 py-2.5 text-[13px] font-medium text-muted first:pl-0 last:pr-0",
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
        "border-b border-border px-3 py-3 align-middle text-text first:pl-0 last:pr-0",
        align === "right" ? "tabular text-right" : align === "center" ? "text-center" : "text-left",
        className,
      )}
      {...rest}
    />
  );
}
