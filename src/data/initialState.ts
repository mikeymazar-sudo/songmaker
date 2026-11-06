import "server-only";
import type { AppState, AuditEntry, ExtractedLine, InvoiceRecord, PriceHistoryEntry } from "@/lib/models";
import { vendors, products, vendorProducts, invoices } from "./seed";
import { extraHistory } from "./history";

export const STATE_VERSION = 1;
export const RESTAURANT_NAME = "SmartPurchasing AI";

function seedInvoiceToRecord(inv: (typeof invoices)[number]): InvoiceRecord {
  const lines: ExtractedLine[] = inv.lines.map((l, i) => ({
    ...l,
    lineId: `${inv.id}-l${i + 1}`,
    confidence: 0.99,
    matchStatus: l.isFee || l.productId ? "matched" : "unmatched",
    flags: [],
  }));
  return {
    ...inv,
    status: "approved",
    lines,
    source: "seed",
    extraction: "imported",
    approvedAt: `${inv.date}T18:00:00.000Z`,
    confidence: 0.99,
  };
}

export function buildInitialState(): AppState {
  const seededAt = "2026-11-06T13:00:00.000Z";
  const invoiceRecords = invoices.map(seedInvoiceToRecord).sort((a, b) => (a.date < b.date ? 1 : -1));

  const history: PriceHistoryEntry[] = [];
  let n = 0;
  for (const h of extraHistory) {
    n += 1;
    history.push({ id: `ph_seed_${n}`, ...h });
  }
  for (const vp of vendorProducts) {
    if (vp.source !== "invoice") continue;
    n += 1;
    const prev = extraHistory
      .filter((h) => h.productId === vp.productId && h.vendorId === vp.vendorId)
      .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    history.push({
      id: `ph_seed_${n}`,
      productId: vp.productId,
      vendorId: vp.vendorId,
      price: vp.price,
      priceUnit: vp.priceUnit,
      date: vp.lastInvoiceDate ?? "2026-10-22",
      previousPrice: prev?.price,
    });
  }
  history.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const audit: AuditEntry[] = [
    {
      id: "audit_seed_1",
      ts: seededAt,
      actor: "System",
      type: "system",
      summary: `Demo data loaded: ${products.length} master products, ${vendors.length} vendors, ${invoices.length} approved invoices`,
      details: "Seeded from the restaurant's October and November 2026 invoices. All prices are per base unit.",
      entityType: "system",
    },
  ];

  return {
    version: STATE_VERSION,
    seededAt,
    restaurantName: RESTAURANT_NAME,
    vendors: [...vendors],
    products: products.map((p) => ({ ...p })),
    vendorProducts: vendorProducts.map((vp) => ({ ...vp })),
    priceHistory: history,
    invoices: invoiceRecords,
    purchaseOrders: [],
    orderOverrides: {},
    routing: { mode: "smart", singleVendorId: "cheney", lineOverrides: {} },
    audit,
  };
}
