import type { Category, VendorId } from "@/data/types";
import type { AppState, ExtractedLine, InvoiceRecord } from "./models";
import { round2, todayISO, uid } from "./format";
import { percentFeeRate } from "./pricing";

interface NewItem {
  sku: string;
  description: string;
  packSize: string;
  qty: number;
  unitPrice: number;
  category: Category;
}

// One "never seen before" item per vendor so the review screen always has something to resolve.
const NEW_ITEMS: Record<VendorId, NewItem> = {
  cheney: { sku: "10188203", description: "SAUCE BBQ SWEET BABY RAYS ORIG 4/1 GAL", packSize: "4 / 1 Gal", qty: 1, unitPrice: 58.9, category: "Condiments & Sauces" },
  sysco: { sku: "7011296", description: "PICKLE SLCD HAMB DILL CHIP 5 GAL", packSize: "1 / 5 Gal", qty: 1, unitPrice: 41.25, category: "Condiments & Sauces" },
  usfoods: { sku: "3346052", description: "CHEESE AMER YEL SLI 160 CT 4/5 LB", packSize: "4 / 5 lb", qty: 2, unitPrice: 52.1, category: "Dairy & Cheese" },
  trs: { sku: "500HC12WH", description: "Choice 12 oz. White Poly Paper Hot Cup", packSize: "1,000 / Case", qty: 1, unitPrice: 59.99, category: "Paper & Packaging" },
  boomers: { sku: "LIMES CSE", description: "LIMES CASE 200 CT", packSize: "Case (200 ct)", qty: 1, unitPrice: 42.5, category: "Produce" },
};

const INVOICE_PREFIX: Record<VendorId, string> = {
  cheney: "01-9100",
  sysco: "7167",
  usfoods: "US-",
  trs: "1017",
  boomers: "26-",
};

function nextInvoiceNumber(vendorId: VendorId): string {
  const n = Math.floor(100000 + Math.random() * 899999);
  switch (vendorId) {
    case "cheney":
      return `${INVOICE_PREFIX.cheney}${n}`;
    case "sysco":
      return `${INVOICE_PREFIX.sysco}${String(n).slice(0, 5)}`;
    case "usfoods":
      return `${INVOICE_PREFIX.usfoods}${String(n).slice(0, 6)}`;
    case "trs":
      return `${INVOICE_PREFIX.trs}${String(n).slice(0, 6)}`;
    case "boomers":
      return `${INVOICE_PREFIX.boomers}${2900 + (n % 90)}`;
  }
}

function confidenceFor(i: number): number {
  const seq = [0.98, 0.58, 0.96, 0.93, 0.99, 0.91, 0.97, 0.95, 0.99, 0.94];
  return seq[i % seq.length];
}

/**
 * Builds a plausible "just scanned" invoice for a vendor using the vendor's most recent
 * approved invoice as a template, with a few deliberate price changes, one low-confidence
 * line and one unknown item, so the review workflow has real work to do.
 */
export function simulateExtraction(
  state: AppState,
  vendorId: VendorId,
  source: InvoiceRecord["source"],
  fileName?: string,
): InvoiceRecord {
  const vendor = state.vendors.find((v) => v.id === vendorId);
  if (!vendor) throw new Error("Unknown vendor");
  const template = state.invoices
    .filter((i) => i.vendorId === vendorId && i.status === "approved" && i.lines.some((l) => !l.isFee))
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];

  const date = todayISO();
  const id = uid("inv");
  const lines: ExtractedLine[] = [];
  const merchandiseTemplate = (template?.lines ?? []).filter((l) => !l.isFee).slice(0, 12);

  merchandiseTemplate.forEach((tl, i) => {
    const product = tl.productId ? state.products.find((p) => p.id === tl.productId) : undefined;
    const vp = product ? state.vendorProducts.find((x) => x.productId === product.id && x.vendorId === vendorId) : undefined;
    let factor = 1;
    const flags: string[] = [];
    if (i === 0) factor = 1.035;
    if (i === 2) factor = 0.98;
    if (i === 4) factor = 1.062;
    const unitPrice = round2(tl.unitPrice * factor);
    const qty = tl.qty;
    const total = round2(unitPrice * qty);
    const confidence = confidenceFor(i);
    if (confidence < 0.7) flags.push("Low confidence: quantity read from a smudged line");
    let normalizedUnitPrice: number | undefined;
    let previousPrice: number | undefined;
    let normalizationFactor: number | undefined;
    if (vp) {
      previousPrice = vp.price;
      normalizedUnitPrice = round2(vp.price * factor);
      normalizationFactor = unitPrice > 0 ? normalizedUnitPrice / unitPrice : 1;
      if (factor !== 1) {
        const delta = (normalizedUnitPrice - vp.price) / vp.price;
        flags.push(`${delta > 0 ? "Price increase" : "Price decrease"} vs last invoice (${(delta * 100).toFixed(1)}%)`);
      }
    }
    lines.push({
      lineId: `${id}-l${i + 1}`,
      sku: tl.sku,
      description: tl.description,
      packSize: tl.packSize,
      qty,
      unitPrice,
      total,
      productId: product?.id,
      category: tl.category ?? product?.category,
      confidence,
      matchStatus: product ? (confidence < 0.7 ? "suggested" : "matched") : "unmatched",
      normalizedUnitPrice,
      normalizationFactor,
      previousPrice,
      flags,
    });
  });

  const extra = NEW_ITEMS[vendorId];
  lines.push({
    lineId: `${id}-l${lines.length + 1}`,
    sku: extra.sku,
    description: extra.description,
    packSize: extra.packSize,
    qty: extra.qty,
    unitPrice: extra.unitPrice,
    total: round2(extra.qty * extra.unitPrice),
    category: extra.category,
    confidence: 0.9,
    matchStatus: "unmatched",
    flags: ["New item: not in the master product list"],
  });

  const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
  let fees = 0;
  for (const fee of vendor.fees) {
    if (fee.kind === "flat") {
      fees = round2(fees + fee.amount);
      lines.push({
        lineId: `${id}-fee-${fee.label.replace(/\W+/g, "").toLowerCase()}`,
        sku: "FEE",
        description: fee.label.toUpperCase(),
        packSize: "Fee",
        qty: 1,
        unitPrice: fee.amount,
        total: fee.amount,
        isFee: true,
        confidence: 0.99,
        matchStatus: "matched",
        flags: [],
      });
    } else {
      const base = lines
        .filter((l) => !l.isFee)
        .reduce((s, l) => s + (percentFeeRate(vendor, l.category ?? "Dry Goods / Pantry / Oils") > 0 ? l.total : 0), 0);
      const amount = round2(base * fee.amount);
      if (amount > 0) {
        fees = round2(fees + amount);
        lines.push({
          lineId: `${id}-fee-pct`,
          sku: "4ACE",
          description: `${fee.label.toUpperCase()} (handwritten)`,
          packSize: "Fee",
          qty: 1,
          unitPrice: amount,
          total: amount,
          isFee: true,
          confidence: 0.74,
          matchStatus: "matched",
          flags: ["Fee not printed on the ticket; derived from the handwritten grand total"],
        });
      }
    }
  }
  const taxable = lines
    .filter((l) => !l.isFee && l.category && vendor.taxableCategories.includes(l.category))
    .reduce((s, l) => s + l.total, 0);
  const tax = round2(taxable * vendor.salesTaxRate);
  const total = round2(subtotal + fees + tax);
  const confidence = round2(lines.reduce((s, l) => s + l.confidence, 0) / Math.max(1, lines.length));

  return {
    id,
    vendorId,
    invoiceNumber: nextInvoiceNumber(vendorId),
    date,
    pages: Math.max(1, Math.ceil(lines.length / 14)),
    status: "processing",
    subtotal,
    fees,
    tax,
    total,
    lines,
    source,
    extraction: "simulated",
    fileName,
    uploadedAt: new Date().toISOString(),
    confidence,
    notes: template ? `Extracted with the ${vendor.name} layout model` : "Extracted with the generic invoice model",
  };
}
