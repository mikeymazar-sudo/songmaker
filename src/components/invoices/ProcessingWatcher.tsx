"use client";

import { useEffect, useMemo } from "react";
import { useActions, useApp } from "@/lib/store";

export const PROCESSING_MS = 2800;

/** Finishes the pretend read of a practice sample. Real photos are finished by useInvoiceUpload. Mounted in the shell. */
export function ProcessingWatcher() {
  const { state, hydrated } = useApp();
  const actions = useActions();
  const processing = useMemo(() => state.invoices.filter((i) => i.status === "processing" && i.extraction !== "claude"), [state.invoices]);

  useEffect(() => {
    if (!hydrated || processing.length === 0) return;
    const timers = processing.map((inv) => {
      const started = inv.uploadedAt ? new Date(inv.uploadedAt).getTime() : Date.now();
      const delay = Math.max(200, PROCESSING_MS - (Date.now() - started));
      return window.setTimeout(() => {
        actions.updateInvoice(inv.id, { status: "needs-review" }, `Practice sample ${inv.invoiceNumber} is ready to check`);
      }, delay);
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [processing, hydrated, actions]);

  return null;
}
