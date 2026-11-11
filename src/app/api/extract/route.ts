import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { forbidden, isAuthenticated, readAllowed, sameOrigin, unauthorized } from "@/lib/server/auth";
import { loadState } from "@/lib/server/db";
import { isConfigured, serverEnv } from "@/lib/server/env";
import { modelErrorResponse, readInvoiceUpload, VENDOR_IDS } from "@/lib/server/invoiceUpload";

export const maxDuration = 120;

const CATEGORY_IDS = [
  "Meat & Proteins",
  "Frozen Foods & Bread",
  "Dairy & Cheese",
  "Dry Goods / Pantry / Oils",
  "Condiments & Sauces",
  "Paper & Packaging",
  "Beverages",
  "Produce",
  "Cleaning & Chemicals",
] as const;

const LineSchema = z.object({
  sku: z.string().describe("Vendor item code as printed, or empty"),
  description: z.string().describe("Description exactly as printed"),
  packSize: z.string().describe("Pack size as printed, e.g. '6 / 5 lb'"),
  qty: z.number().describe("Quantity in the unit the vendor bills (cases, lbs, each)"),
  unitPrice: z.number().describe("Price per billed unit"),
  total: z.number().describe("Extended line total"),
  isFee: z.boolean().describe("True for delivery, fuel, surcharge or other non-merchandise lines"),
  derived: z.boolean().describe("True only for a fee line that is not on the document, which you added because a handwritten total is higher than the lines"),
  productId: z.string().nullable().describe("Master product id from the catalog when this line clearly is that product, otherwise null"),
  category: z.enum(CATEGORY_IDS).nullable(),
  confidence: z.number().describe("0 to 1 confidence that qty, price and description were read correctly"),
  normalizedUnitPrice: z.number().nullable().describe("Price per the master product's base unit when productId is set, else null"),
  flags: z.array(z.string()).describe("Short notes on anything unusual: handwritten values, catch weight, duplicates, tax on resale items"),
});

const InvoiceSchema = z.object({
  vendorId: z.enum(VENDOR_IDS).nullable().describe("One of the known vendors when the document matches it, else null"),
  vendorNameOnDocument: z.string(),
  invoiceNumber: z.string(),
  date: z.string().describe("YYYY-MM-DD"),
  pages: z.number(),
  subtotal: z.number().describe("Merchandise subtotal"),
  fees: z.number().describe("Sum of delivery, fuel and surcharge lines"),
  tax: z.number(),
  total: z.number().describe("Grand total as printed or handwritten"),
  lines: z.array(LineSchema),
  notes: z.string().describe("One or two sentences on reconciliation issues, or empty"),
});

const SYSTEM_PROMPT = `You are the invoice reader for a restaurant purchasing system. You receive one supplier invoice or delivery ticket (image or PDF) plus the restaurant's master product catalog and the vendor SKU mappings it already knows.

Extract every line on the document:
- One entry per merchandise line, in document order. Keep descriptions and item codes exactly as printed.
- Delivery fees, fuel surcharges and other non-merchandise charges are separate lines with isFee = true. Sales tax is NOT a line; report it in the tax field.
- Local runners sometimes hand-write prices and add an unprinted percentage delivery fee. If the handwritten grand total exceeds the printed lines, add a fee line for the difference, set derived = true on it, and flag it as "Fee not printed; derived from handwritten total". derived is false on every other line.
- Catch-weight items (billed per pound with a case count) keep qty = cases and unitPrice = total / cases; add a flag describing the per-pound pricing.
- Map a line to a master product id only when it is clearly the same item, pack size and form. Prefer the known SKU mappings for that vendor. When unsure, leave productId null; never guess.
- normalizedUnitPrice is the price per the master product's base unit: per case for case products, total divided by pounds for lb products, per gallon for gal products, per unit for each/bag/bottle/bucket products. Null when productId is null.
- confidence is per line, from 0 to 1. Lower it for smudged, handwritten or ambiguous values.
- vendorId: choose from the known vendors only when the document clearly belongs to one of them.
- Dates as YYYY-MM-DD. Numbers as plain numbers. Do not invent lines that are not on the document.`;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return forbidden();
  if (!isAuthenticated(request)) return unauthorized();
  if (!isConfigured().extraction) {
    return Response.json({ error: "Real extraction needs ANTHROPIC_API_KEY on the server." }, { status: 503 });
  }
  if (!readAllowed(request, "first")) {
    return Response.json({ error: "Too many invoices this hour. Try again later." }, { status: 429 });
  }

  const upload = await readInvoiceUpload(request);
  if (!upload.ok) return upload.response;
  const { document: documentBlock, vendorHint } = upload;

  let state: Awaited<ReturnType<typeof loadState>> = null;
  try {
    state = await loadState();
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Could not load the catalog" }, { status: 500 });
  }
  const catalog = (state?.products ?? [])
    .filter((p) => !p.archived)
    .map((p) => ({ id: p.id, name: p.name, category: p.category, packSize: p.packSize, baseUnit: p.baseUnit }));
  const skus = (state?.vendorProducts ?? [])
    .filter((vp) => !vendorHint || vp.vendorId === vendorHint)
    .map((vp) => ({ vendorId: vp.vendorId, sku: vp.sku, description: vp.description, packSize: vp.packSize, productId: vp.productId, price: vp.price, priceUnit: vp.priceUnit }));
  const vendors = (state?.vendors ?? []).map((v) => ({ id: v.id, name: v.name, type: v.type, fees: v.fees }));

  const context = [
    vendorHint ? `Vendor hint from the user: ${vendorHint}.` : "No vendor hint; identify the vendor from the document.",
    `Known vendors: ${JSON.stringify(vendors)}`,
    `Master product catalog: ${JSON.stringify(catalog)}`,
    `Known vendor SKU mappings: ${JSON.stringify(skus)}`,
    "Read the attached document and return the structured extraction.",
  ].join("\n\n");

  const client = new Anthropic({ apiKey: serverEnv.anthropicApiKey() });
  try {
    const response = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: [documentBlock, { type: "text", text: context }] }],
      output_config: { format: zodOutputFormat(InvoiceSchema), effort: "high" },
    });
    if (response.stop_reason === "refusal") {
      return Response.json({ error: "The model declined to read this document." }, { status: 422 });
    }
    const parsed = response.parsed_output;
    if (!parsed) return Response.json({ error: "The model returned an unreadable result. Try a clearer photo." }, { status: 502 });
    return Response.json({ invoice: parsed, usage: response.usage });
  } catch (error) {
    return modelErrorResponse(error);
  }
}
