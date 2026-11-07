import type { ReactNode } from "react";
import { cn } from "@/lib/format";

export type BadgeTone = "neutral" | "success" | "warning" | "danger";

const tones: Record<BadgeTone, string> = {
  neutral: "text-muted",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

/** A quiet status word. Color on the text only, never a filled pill. */
export function Badge({
  tone = "neutral",
  className,
  children,
  dot,
  title,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
  dot?: boolean;
  title?: string;
}) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium", tones[tone], className)}>
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
