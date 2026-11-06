import type { Category, Product, Vendor, VendorId } from "@/data/types";
import type { AppState, ProductRecord, RoutedLine, RoutingResult, VendorCart, VendorQuote } from "./models";
import { fmtNum, money, round2, unitLabel } from "./format";

export function percentFeeRate(vendor: Vendor, category: Category): number {
  return vendor.fees.reduce((sum, fee) => {
    if (fee.kind !== "percent") return sum;
    if (fee.appliesTo === "non-produce" && category === "Produce") return sum;
    return sum + fee.amount;
  }, 0);
}

export function flatFeeTotal(vendor: Vendor): number {
  return vendor.fees.reduce((s, f) => (f.kind === "flat" ? s + f.amount : s), 0);
}

export function landedUnitPrice(vendor: Vendor, category: Category, price: number): number {
  return round2(price * (1 + percentFeeRate(vendor, category)));
}

export function vendorById(state: AppState, id: VendorId): Vendor {
  const v = state.vendors.find((x) => x.id === id);
  if (!v) throw new Error(`Unknown vendor ${id}`);
  return v;
}

export function productById(state: AppState, id: string): ProductRecord | undefined {
  return state.products.find((p) => p.id === id);
}

export function getQuotes(state: AppState, product: Product): VendorQuote[] {
  const quotes: VendorQuote[] = [];
  for (const vp of state.vendorProducts) {
    if (vp.productId !== product.id) continue;
    const vendor = state.vendors.find((v) => v.id === vp.vendorId);
    if (!vendor) continue;
    quotes.push({
      vendorId: vp.vendorId,
      vendor,
      sku: vp.sku,
      description: vp.description,
      packSize: vp.packSize,
      price: vp.price,
      landedPrice: landedUnitPrice(vendor, product.category, vp.price),
      priceUnit: vp.priceUnit,
      source: vp.source,
      lastInvoiceDate: vp.lastInvoiceDate,
    });
  }
  return quotes.sort((a, b) => a.landedPrice - b.landedPrice || a.vendor.name.localeCompare(b.vendor.name));
}

export function bestQuote(quotes: VendorQuote[], preferred?: VendorId): VendorQuote | undefined {
  if (quotes.length === 0) return undefined;
  const min = quotes[0].landedPrice;
  const tied = quotes.filter((q) => Math.abs(q.landedPrice - min) < 0.005);
  return tied.find((q) => q.vendorId === preferred) ?? tied[0];
}

export function suggestedQty(product: Product): number {
  return Math.max(0, round2(product.parLevel - product.onHand));
}

export function orderQty(state: AppState, product: Product): number {
  const o = state.orderOverrides[product.id];
  return o !== undefined ? o : suggestedQty(product);
}

export function isOverridden(state: AppState, product: Product): boolean {
  return state.orderOverrides[product.id] !== undefined;
}

export function routeOrder(state: AppState): RoutingResult {
  const lines: RoutedLine[] = [];
  const missingQuotes: ProductRecord[] = [];

  for (const product of state.products) {
    if (product.archived) continue;
    const qty = orderQty(state, product);
    if (qty <= 0) continue;
    const quotes = getQuotes(state, product);
    if (quotes.length === 0) {
      missingQuotes.push(product);
      continue;
    }
    const best = bestQuote(quotes, product.preferredVendorId) as VendorQuote;
    let chosen = best;
    let overridden = false;
    const override = state.routing.lineOverrides[product.id];
    if (override) {
      const q = quotes.find((x) => x.vendorId === override);
      if (q) {
        chosen = q;
        overridden = true;
      }
    } else if (state.routing.mode === "single") {
      const q = quotes.find((x) => x.vendorId === state.routing.singleVendorId);
      if (q) chosen = q;
    }
    const highestLanded = Math.max(...quotes.map((q) => q.landedPrice));
    const merchandise = round2(qty * chosen.price);
    const percentFee = round2(qty * chosen.price * percentFeeRate(chosen.vendor, product.category));
    const savings = quotes.length > 1 ? round2((highestLanded - chosen.landedPrice) * qty) : 0;
    lines.push({ product, qty, vendorId: chosen.vendorId, quote: chosen, quotes, highestLanded, merchandise, percentFee, savings, overridden });
  }

  const carts: VendorCart[] = [];
  for (const vendor of state.vendors) {
    const vl = lines.filter((l) => l.vendorId === vendor.id);
    if (vl.length === 0) continue;
    const merchandise = round2(vl.reduce((s, l) => s + l.merchandise, 0));
    const percentFees = round2(vl.reduce((s, l) => s + l.percentFee, 0));
    const flatFees = flatFeeTotal(vendor);
    const taxable = vl
      .filter((l) => vendor.taxableCategories.includes(l.product.category))
      .reduce((s, l) => s + l.merchandise, 0);
    const tax = round2(taxable * vendor.salesTaxRate);
    const total = round2(merchandise + percentFees + flatFees + tax);
    const savings = round2(vl.reduce((s, l) => s + l.savings, 0));
    const unoptimized = round2(vl.reduce((s, l) => s + l.highestLanded * l.qty, 0));
    carts.push({
      vendor,
      lines: vl.sort(
        (a, b) => a.product.category.localeCompare(b.product.category) || a.product.name.localeCompare(b.product.name),
      ),
      units: round2(vl.reduce((s, l) => s + l.qty, 0)),
      merchandise,
      percentFees,
      flatFees,
      tax,
      total,
      savings,
      unoptimized,
    });
  }
  carts.sort((a, b) => b.total - a.total);
  const sum = (f: (c: VendorCart) => number) => round2(carts.reduce((s, c) => s + f(c), 0));
  return {
    lines,
    carts,
    units: sum((c) => c.units),
    merchandise: sum((c) => c.merchandise),
    fees: sum((c) => c.percentFees + c.flatFees),
    tax: sum((c) => c.tax),
    total: sum((c) => c.total),
    savings: sum((c) => c.savings),
    unoptimized: sum((c) => c.unoptimized),
    vendorsActive: carts.length,
    missingQuotes,
  };
}

export function priceSpread(quotes: VendorQuote[]): { low: number; high: number; spreadPct: number } | null {
  if (quotes.length < 2) return null;
  const low = quotes[0].landedPrice;
  const high = quotes[quotes.length - 1].landedPrice;
  return { low, high, spreadPct: low > 0 ? (high - low) / low : 0 };
}

export function buildOrderText(cart: VendorCart, restaurantName: string, dateLabel: string): string {
  const header = [
    `${restaurantName} — order for ${cart.vendor.name}`,
    `Date: ${dateLabel}`,
    `Terms: ${cart.vendor.terms} · ${cart.vendor.orderingMethod}`,
    "",
  ];
  const body = cart.lines.map(
    (l) =>
      `${fmtNum(l.qty)} ${unitLabel(l.product.baseUnit)}  ${l.product.name}  [${l.quote.sku}]  ${l.quote.packSize}  @ ${money(l.quote.price)} = ${money(l.merchandise)}`,
  );
  const footer = [
    "",
    `Merchandise: ${money(cart.merchandise)}`,
    cart.percentFees > 0 ? `Vendor fees: ${money(cart.percentFees)}` : "",
    cart.flatFees > 0 ? `Delivery / fuel: ${money(cart.flatFees)}` : "",
    cart.tax > 0 ? `Est. sales tax: ${money(cart.tax)}` : "",
    `Estimated total: ${money(cart.total)}`,
    "",
    "Please confirm pricing before delivery. This order was prepared with SmartPurchasing AI.",
  ].filter(Boolean);
  return [...header, ...body, ...footer].join("\n");
}
