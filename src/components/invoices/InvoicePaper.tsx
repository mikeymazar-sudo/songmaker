"use client";

import type { Vendor } from "@/data/types";
import { fmtDate, fmtNum, money } from "@/lib/format";
import type { InvoiceRecord } from "@/lib/models";
import { getPreview } from "./previewStore";

export function InvoicePaper({ invoice, vendor }: { invoice: InvoiceRecord; vendor?: Vendor }) {
  const preview = getPreview(invoice.id);
  if (preview) {
    return (
      <div className="rounded-xl border border-border bg-surface-2 p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt={`Uploaded invoice ${invoice.invoiceNumber}`} className="mx-auto max-h-[70vh] rounded-lg object-contain shadow" />
        <p className="mt-2 text-center text-xs text-muted">{invoice.fileName}</p>
      </div>
    );
  }
  const merchandise = invoice.lines.filter((l) => !l.isFee);
  const fees = invoice.lines.filter((l) => l.isFee);
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3 sm:p-5">
      <div className="mx-auto max-w-lg rotate-[-0.4deg] rounded-sm bg-white px-6 py-6 font-mono text-[11px] leading-relaxed text-slate-800 shadow-[0_10px_30px_rgba(15,23,42,0.18)] dark:bg-slate-100">
        <div className="flex items-start justify-between border-b border-dashed border-slate-300 pb-3">
          <div>
            <div className="text-sm font-bold uppercase tracking-wide">{vendor?.name ?? invoice.vendorId}</div>
            <div className="text-slate-500">{vendor?.type === "local-runner" ? "DELIVERY TICKET" : "INVOICE"}</div>
          </div>
          <div className="text-right">
            <div>INV # {invoice.invoiceNumber}</div>
            <div>{fmtDate(invoice.date)}</div>
            <div>PAGE 1 OF {invoice.pages}</div>
          </div>
        </div>
        <table className="mt-3 w-full">
          <thead>
            <tr className="border-b border-slate-300 text-left text-[10px] uppercase text-slate-500">
              <th className="py-1 pr-2">Item</th>
              <th className="py-1 pr-2">Description</th>
              <th className="py-1 pr-2 text-right">Qty</th>
              <th className="py-1 pr-2 text-right">Price</th>
              <th className="py-1 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {merchandise.map((l) => (
              <tr key={l.lineId} className="align-top">
                <td className="py-0.5 pr-2 text-slate-500">{l.sku}</td>
                <td className="py-0.5 pr-2 uppercase">
                  {l.description}
                  <div className="text-[10px] text-slate-500">{l.packSize}</div>
                </td>
                <td className="py-0.5 pr-2 text-right">{fmtNum(l.qty)}</td>
                <td className="py-0.5 pr-2 text-right">{l.unitPrice.toFixed(2)}</td>
                <td className="py-0.5 text-right">{l.total.toFixed(2)}</td>
              </tr>
            ))}
            {fees.map((l) => (
              <tr key={l.lineId} className="text-slate-600">
                <td className="py-0.5 pr-2">{l.sku}</td>
                <td className="py-0.5 pr-2 uppercase" colSpan={3}>
                  {l.description}
                </td>
                <td className="py-0.5 text-right">{l.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 border-t border-dashed border-slate-300 pt-2 text-right">
          <div>SUBTOTAL {money(invoice.subtotal)}</div>
          {invoice.fees > 0 ? <div>FEES {money(invoice.fees)}</div> : null}
          {invoice.tax > 0 ? <div>TAX {money(invoice.tax)}</div> : null}
          <div className="mt-1 text-sm font-bold">TOTAL {money(invoice.total)}</div>
        </div>
        <div className="mt-4 text-center text-[10px] text-slate-400">THANK YOU FOR YOUR BUSINESS</div>
      </div>
      <p className="mt-3 text-center text-xs text-muted">
        {invoice.source === "seed" ? "Rendered from the stored invoice data." : "Preview rendered from the extracted data. Upload a photo to see the original here."}
      </p>
    </div>
  );
}
