import type { HTMLAttributes } from "react";
import { cn } from "@/lib/format";

export type PanelTone = "plain" | "pass" | "warn" | "fail";

const tones: Record<PanelTone, string> = {
  plain: "border-border bg-surface-2",
  pass: "border-success/25 bg-success-soft",
  warn: "border-warning/30 bg-warning-soft",
  fail: "border-danger/25 bg-danger-soft",
};

/** A soft box for the one thing on a screen that should be read first. Color only when it carries a verdict. */
export function Panel({ tone = "plain", className, ...rest }: HTMLAttributes<HTMLDivElement> & { tone?: PanelTone }) {
  return <div className={cn("rounded-2xl border p-4 md:p-5", tones[tone], className)} {...rest} />;
}
