import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { forbidden, isAuthenticated, readAllowed, sameOrigin, unauthorized } from "@/lib/server/auth";
import { isConfigured, serverEnv } from "@/lib/server/env";
import { modelErrorResponse, readInvoiceUpload } from "@/lib/server/invoiceUpload";

export const maxDuration = 120;

/*
 * The second read. It gets the same paper as /api/extract and nothing else: not the first read, not the
 * product catalog. Its only job is to copy the numbers off the page, so the app can compare two separate
 * reads instead of asking one reader whether it made a mistake.
 */

const LineSchema = z.object({
  sku: z.string().describe("Item code as printed, or empty"),
  description: z.string().describe("Description exactly as printed"),
  qty: z.number().describe("Quantity billed, in the unit the vendor bills"),
  unitPrice: z.number().describe("Price per billed unit"),
  total: z.number().describe("Line amount exactly as printed"),
  isFee: z.boolean().describe("True for delivery, fuel, surcharge or other non-merchandise lines"),
  unclear: z.boolean().describe("True when any number on this line is smudged, handwritten over, or otherwise hard to read"),
});

const SecondReadSchema = z.object({
  invoiceNumber: z.string(),
  date: z.string().describe("YYYY-MM-DD, or empty if the document shows no date"),
  subtotal: z.number().nullable().describe("Merchandise subtotal as printed, or null if the document shows none"),
  tax: z.number().nullable().describe("Sales tax as printed, or null if the document shows none"),
  total: z.number().nullable().describe("Grand total exactly as printed or handwritten, or null if the document shows none"),
  lines: z.array(LineSchema),
  legibility: z.enum(["good", "fair", "poor"]).describe("How readable the document is overall"),
  notes: z.string().describe("One sentence on anything that made the numbers hard to read, or empty"),
});

const SYSTEM_PROMPT = `You are the second reader of a supplier invoice for a restaurant. Someone else has already keyed this invoice. You have not seen their work, and your read will be compared with theirs number by number to catch mistakes, so the value of your read is that it is independent and literal.

Copy what is on the page:
- One entry per charged line, in document order, with the item code and description as printed.
- Delivery fees, fuel surcharges and other non-merchandise charges that appear on the page are lines with isFee = true. Sales tax is not a line; report it in the tax field.
- Report only what the page shows. If a handwritten grand total is higher than the lines, report that total as it is written and do not add a line to explain the difference.
- Catch-weight items (billed per pound with a case count) use qty = cases and unitPrice = line amount divided by cases, so both readers describe the line the same way.
- Read each digit from the page rather than working it out. If quantity times price does not equal the printed amount, report the three numbers as printed and leave the mismatch in place; that mismatch is exactly what the comparison is looking for.
- When a number is hard to read, give your best reading and set unclear = true on that line.
- Dates as YYYY-MM-DD. Numbers as plain numbers.`;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return forbidden();
  if (!isAuthenticated(request)) return unauthorized();
  if (!isConfigured().extraction) {
    return Response.json({ error: "Reading invoices needs ANTHROPIC_API_KEY on the server." }, { status: 503 });
  }
  if (!readAllowed(request, "second")) {
    return Response.json({ error: "Too many invoices this hour. Try again later." }, { status: 429 });
  }

  const upload = await readInvoiceUpload(request);
  if (!upload.ok) return upload.response;

  // Fail before the function's own time limit, so the app gets an answer it can show instead of a dropped connection.
  const client = new Anthropic({ apiKey: serverEnv.anthropicApiKey(), timeout: 100_000, maxRetries: 0 });
  try {
    const response = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: [upload.document, { type: "text", text: "Read the attached invoice and return every charged line and the totals as printed." }] }],
      output_config: { format: zodOutputFormat(SecondReadSchema), effort: "high" },
    });
    if (response.stop_reason === "refusal") {
      return Response.json({ error: "The model declined to read this document." }, { status: 422 });
    }
    const read = response.parsed_output;
    if (!read) return Response.json({ error: "The second read came back unreadable." }, { status: 502 });
    return Response.json({ read, usage: response.usage });
  } catch (error) {
    return modelErrorResponse(error);
  }
}
