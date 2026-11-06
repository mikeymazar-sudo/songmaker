"use client";

import { useEffect, useMemo } from "react";
import { pct } from "@/lib/format";
import { useActions, useApp } from "@/lib/store";

export const PROCESSING_MS = 2800;

/** Finishes simulated AI extraction for any invoice left in the "processing" state. Mounted in the shell. */
export function ProcessingWatcher() {
  const { state, hydrated } = useApp();
  const actions = useActions();
  const processing = useMemo(() => state.invoices.filter((i) => i.status === "processing"), [state.invoices]);

  useEffect(() => {
    if (!hydrated || processing.length === 0) return;
    const timers = processing.map((inv) => {
      const started = inv.uploadedAt ? new Date(inv.uploadedAt).getTime() : Date.now();
      const delay = Math.max(200, PROCESSING_MS - (Date.now() - started));
      return window.setTimeout(() => {
        const lines = inv.lines.filter((l) => !l.isFee).length;
        const flags = inv.lines.reduce((s, l) => s + l.flags.length, 0);
        const unmatched = inv.lines.filter((l) => !l.isFee && l.matchStatus === "unmatched").length;
        actions.updateInvoice(
          inv.id,
          { status: "needs-review" },
          `AI extraction finished for invoice ${inv.invoiceNumber}: ${lines} lines read, ${flags} flag${flags === 1 ? "" : "s"}, ${unmatched} unmatched item${unmatched === 1 ? "" : "s"}, ${pct(inv.confidence ?? 0, 0)} average confidence`,
        );
      }, delay);
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [processing, hydrated, actions]);

  return null;
}
