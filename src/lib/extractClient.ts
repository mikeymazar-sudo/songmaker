import type { Category, VendorId } from "@/data/types";
import type { AppState, ExtractedLine, InvoiceRecord } from "./models";
import { round2, todayISO, uid } from "./format";

export interface ExtractedLineDto {
  sku: string;
  description: string;
  packSize: string;
  qty: number;
  unitPrice: number;
  total: number;
  isFee: boolean;
  productId: string | null;
  category: string | null;
  confidence: number;
  normalizedUnitPrice: number | null;
  flags: string[];
}

export interface ExtractResponse {
  invoice: {
    vendorId: VendorId | null;
    vendorNameOnDocument: string;
    invoiceNumber: string;
    date: string;
    pages: number;
    subtotal: number;
    fees: number;
    tax: number;
    total: number;
    lines: ExtractedLineDto[];
    notes: string;
  };
}

export function buildPendingInvoice(vendorId: VendorId, source: InvoiceRecord["source"], fileName: string): InvoiceRecord {
  return {
    id: uid("inv"),
    vendorId,
    invoiceNumber: "…",
    date: todayISO(),
    pages: 1,
    status: "processing",
    subtotal: 0,
    fees: 0,
    tax: 0,
    total: 0,
    lines: [],
    source,
    extraction: "claude",
    fileName,
    uploadedAt: new Date().toISOString(),
    notes: "Reading with Claude…",
  };
}

/** Turns the extraction API response into the fields of a reviewable invoice record. */
export function finalizeExtraction(state: AppState, pending: InvoiceRecord, data: ExtractResponse): Partial<InvoiceRecord> {
  const inv = data.invoice;
  const vendorId = inv.vendorId ?? pending.vendorId;
  const vendor = state.vendors.find((v) => v.id === vendorId);
  const productIds = new Set(state.products.map((p) => p.id));

  const lines: ExtractedLine[] = inv.lines.map((l, i) => {
    const productId = l.productId && productIds.has(l.productId) ? l.productId : undefined;
    const product = productId ? state.products.find((p) => p.id === productId) : undefined;
    const vp = productId ? state.vendorProducts.find((x) => x.productId === productId && x.vendorId === vendorId) : undefined;
    const flags = [...(l.flags ?? [])];
    const confidence = Math.max(0, Math.min(1, Number(l.confidence) || 0));
    let normalized = l.normalizedUnitPrice ?? undefined;
    if (product && normalized === undefined && product.baseUnit === "case") normalized = l.unitPrice;
    if (vp && normalized !== undefined && vp.price > 0) {
      const delta = (normalized - vp.price) / vp.price;
      if (Math.abs(delta) > 0.005) flags.push(`${delta > 0 ? "Price increase" : "Price decrease"} vs last invoice (${(delta * 100).toFixed(1)}%)`);
    }
    if (!l.isFee && !productId) flags.push("New item: not in the master product list");
    if (confidence < 0.7) flags.push("Low confidence: check this line against the paper");
    return {
      lineId: `${pending.id}-l${i + 1}`,
      sku: l.sku || "",
      description: l.description,
      packSize: l.packSize || "",
      qty: round2(Number(l.qty) || 0),
      unitPrice: round2(Number(l.unitPrice) || 0),
      total: round2(Number(l.total) || round2((Number(l.qty) || 0) * (Number(l.unitPrice) || 0))),
      isFee: Boolean(l.isFee),
      productId,
      category: (l.category as Category | null) ?? product?.category,
      confidence,
      matchStatus: l.isFee ? "matched" : productId ? (confidence >= 0.8 ? "matched" : "suggested") : "unmatched",
      normalizedUnitPrice: productId ? normalized : undefined,
      previousPrice: vp?.price,
      flags: Array.from(new Set(flags)),
    };
  });

  const subtotal = round2(lines.filter((l) => !l.isFee).reduce((s, l) => s + l.total, 0));
  const fees = round2(lines.filter((l) => l.isFee).reduce((s, l) => s + l.total, 0));
  const tax = round2(Number(inv.tax) || 0);
  const printedTotal = round2(Number(inv.total) || 0);
  const computed = round2(subtotal + fees + tax);
  const notes: string[] = [];
  if (inv.notes) notes.push(inv.notes);
  if (printedTotal > 0 && Math.abs(printedTotal - computed) > 0.05) notes.push(`Printed total ${printedTotal.toFixed(2)} differs from extracted lines (${computed.toFixed(2)}).`);
  if (!inv.vendorId) notes.push(`Vendor on document: ${inv.vendorNameOnDocument || "unknown"}; assigned to ${vendor?.name ?? vendorId}.`);
  const confidence = lines.length ? round2(lines.reduce((s, l) => s + l.confidence, 0) / lines.length) : 0;

  return {
    vendorId,
    invoiceNumber: inv.invoiceNumber || pending.invoiceNumber,
    date: /^\d{4}-\d{2}-\d{2}$/.test(inv.date) ? inv.date : pending.date,
    pages: Math.max(1, Math.round(Number(inv.pages) || 1)),
    status: "needs-review",
    subtotal,
    fees,
    tax,
    total: printedTotal > 0 ? printedTotal : computed,
    lines,
    confidence,
    extraction: "claude",
    notes: notes.join(" ") || "Extracted with Claude",
  };
}
