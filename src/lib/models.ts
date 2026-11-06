import type { Category, Invoice, InvoiceLine, Product, Unit, Vendor, VendorId, VendorProduct } from "@/data/types";

export type ProductRecord = Product & { archived?: boolean; createdAt?: string };

export type MatchStatus = "matched" | "suggested" | "unmatched";

export interface ExtractedLine extends InvoiceLine {
  lineId: string;
  confidence: number;            // 0..1
  matchStatus: MatchStatus;
  normalizedUnitPrice?: number;  // price per the product's base unit
  previousPrice?: number;        // previous price per base unit at this vendor
  flags: string[];
}

export type InvoiceStatus = "processing" | "needs-review" | "approved" | "rejected";

export interface InvoiceRecord extends Omit<Invoice, "status" | "lines"> {
  status: InvoiceStatus;
  lines: ExtractedLine[];
  source: "seed" | "upload" | "camera" | "sample";
  fileName?: string;
  uploadedAt?: string;
  approvedAt?: string;
  confidence?: number;
  rejectReason?: string;
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
