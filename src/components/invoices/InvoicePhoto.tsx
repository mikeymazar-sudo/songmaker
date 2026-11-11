"use client";

import type { InvoiceRecord } from "@/lib/models";
import { getPreview } from "./previewStore";

/** The photo that was just taken. It is kept only while the app stays open, so it is absent on older invoices. */
export function InvoicePhoto({ invoice }: { invoice: InvoiceRecord }) {
  const preview = getPreview(invoice.id);
  if (!preview) return null;
  return (
    <div className="rounded-2xl bg-surface-3 p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={preview} alt={`Photo of invoice ${invoice.invoiceNumber}`} className="mx-auto max-h-[75vh] rounded-xl object-contain" />
    </div>
  );
}
