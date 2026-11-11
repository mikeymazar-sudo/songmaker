import type { Category, Invoice, InvoiceLine, Product, Unit, Vendor, VendorId, VendorProduct } from "@/data/types";

export type ProductRecord = Product & { archived?: boolean; createdAt?: string };

export type MatchStatus = "matched" | "suggested" | "unmatched";

export interface LineValues {
  qty: number;
  unitPrice: number;
  total: number;
}

/** How a line held up when the invoice was read a second time, and whether the owner has looked at it. */
export interface LineCheck {
  /** What the second, separate read made of this line. Absent when no second read ran. */
  status?: "confirmed" | "corrected" | "unsure";
  note?: string;
  /** The first read's numbers, when the second read replaced them. */
  was?: LineValues;
  /** The second read's numbers, when the two reads disagree and nothing settled it. */
  other?: LineValues;
  /** The owner looked at this line and said it is right. */
  ok?: boolean;
}

export interface ExtractedLine extends InvoiceLine {
  lineId: string;
  confidence: number;            // 0..1
  matchStatus: MatchStatus;
  normalizedUnitPrice?: number;  // price per the product's base unit
  normalizationFactor?: number;  // base units per billed unit (normalizedUnitPrice = unitPrice * factor)
  previousPrice?: number;        // previous price per base unit at this vendor
  flags: string[];
  /** A fee that is not printed on the paper; worked out from a handwritten total. */
  derived?: boolean;
  check?: LineCheck;
}

export interface SecondReadSummary {
  at: string;
  legibility: "good" | "fair" | "poor";
  invoiceNumber?: string;
  date?: string;
  /** Grand total and tax as the second read saw them on the paper. */
  total?: number;
  tax?: number;
  /** How the first read's lines held up, at the moment the two reads were compared. */
  lines: number;
  confirmed: number;
  corrected: number;
  unsure: number;
  added: number;
  notes?: string;
}

/** What the app did to check its own reading of an invoice. */
export interface InvoiceVerification {
  /** Grand total printed or handwritten on the paper, from the first read. */
  printedTotal?: number;
  secondRead?: SecondReadSummary;
  /** Why the second read did not run, when it failed. */
  secondReadError?: string;
}

export type InvoiceStatus = "processing" | "needs-review" | "approved" | "rejected";

export interface InvoiceRecord extends Omit<Invoice, "status" | "lines"> {
  status: InvoiceStatus;
  lines: ExtractedLine[];
  source: "seed" | "upload" | "camera" | "sample";
  extraction?: "imported" | "simulated" | "claude";
  fileName?: string;
  uploadedAt?: string;
  approvedAt?: string;
  confidence?: number;
  rejectReason?: string;
  verification?: InvoiceVerification;
}

export interface PriceHistoryEntry {
  id: string;
  productId: string;
  vendorId: VendorId;
  price: number;
  priceUnit: Unit;
  date: string;          // YYYY-MM-DD
  invoiceId?: string;
  previousPrice?: number;
}

export interface PurchaseOrderLine {
  productId: string;
  name: string;
  sku: string;
  packSize: string;
  qty: number;
  unit: Unit;
  unitPrice: number;
  total: number;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  vendorId: VendorId;
  createdAt: string;
  status: "approved" | "sent";
  lines: PurchaseOrderLine[];
  merchandise: number;
  fees: number;
  tax: number;
  total: number;
  savings: number;
}

export type AuditType = "inventory" | "order" | "invoice" | "price" | "product" | "system";

export interface AuditEntry {
  id: string;
  ts: string;
  actor: string;
  type: AuditType;
  summary: string;
  details?: string;
  entityType?: "product" | "invoice" | "purchase-order" | "vendor" | "system";
  entityId?: string;
}

export interface RoutingSettings {
  mode: "smart" | "single";
  singleVendorId: VendorId;
  lineOverrides: Record<string, VendorId>;
}

export interface AppState {
  version: number;
  seededAt: string;
  restaurantName: string;
  vendors: Vendor[];
  products: ProductRecord[];
  vendorProducts: VendorProduct[];
  priceHistory: PriceHistoryEntry[];
  invoices: InvoiceRecord[];
  purchaseOrders: PurchaseOrder[];
  orderOverrides: Record<string, number>;
  routing: RoutingSettings;
  audit: AuditEntry[];
}

export interface VendorQuote {
  vendorId: VendorId;
  vendor: Vendor;
  sku: string;
  description: string;
  packSize: string;
  price: number;         // per base unit
  landedPrice: number;   // price including percent fees
  priceUnit: Unit;
  source: "invoice" | "price-sheet";
  lastInvoiceDate?: string;
}

export interface RoutedLine {
  product: ProductRecord;
  qty: number;
  vendorId: VendorId;
  quote: VendorQuote;
  quotes: VendorQuote[];
  highestLanded: number;
  merchandise: number;
  percentFee: number;
  savings: number;
  overridden: boolean;
}

export interface VendorCart {
  vendor: Vendor;
  lines: RoutedLine[];
  units: number;
  merchandise: number;
  percentFees: number;
  flatFees: number;
  tax: number;
  total: number;
  savings: number;
  unoptimized: number;
}

export interface RoutingResult {
  lines: RoutedLine[];
  carts: VendorCart[];
  units: number;
  merchandise: number;
  fees: number;
  tax: number;
  total: number;
  savings: number;
  unoptimized: number;
  vendorsActive: number;
  missingQuotes: ProductRecord[];
}

export type CategoryFilter = Category | "All";

export function emptyState(): AppState {
  return {
    version: 1,
    seededAt: "",
    restaurantName: "SmartPurchasing AI",
    vendors: [],
    products: [],
    vendorProducts: [],
    priceHistory: [],
    invoices: [],
    purchaseOrders: [],
    orderOverrides: {},
    routing: { mode: "smart", singleVendorId: "cheney", lineOverrides: {} },
    audit: [],
  };
}
