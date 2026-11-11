import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const VENDOR_IDS = ["cheney", "sysco", "usfoods", "trs", "boomers"] as const;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export type InvoiceUpload =
  | { ok: true; document: Anthropic.ContentBlockParam; vendorHint: string }
  | { ok: false; response: Response };

/** Reads the uploaded invoice out of a multipart request and turns it into a block the model can see. */
export async function readInvoiceUpload(request: Request): Promise<InvoiceUpload> {
  const fail = (error: string, status: number): InvoiceUpload => ({ ok: false, response: Response.json({ error }, { status }) });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Expected multipart form data", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return fail("Missing file", 400);
  if (file.size > 4_000_000) return fail("File is larger than 4 MB. Take a smaller photo or split the PDF.", 413);
  const rawHint = String(form.get("vendorId") ?? "");
  const vendorHint = (VENDOR_IDS as readonly string[]).includes(rawHint) ? rawHint : "";

  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf && !IMAGE_TYPES.has(file.type)) {
    return fail(`Unsupported file type ${file.type || "unknown"}. Use a JPEG, PNG, WebP or PDF.`, 415);
  }
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const document: Anthropic.ContentBlockParam = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
    : { type: "image", source: { type: "base64", media_type: file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data } };
  return { ok: true, document, vendorHint };
}

/** Turns an SDK error into a response the app can show to the owner. */
export function modelErrorResponse(error: unknown): Response {
  if (error instanceof Anthropic.AuthenticationError) {
    return Response.json({ error: "The ANTHROPIC_API_KEY on the server was rejected." }, { status: 503 });
  }
  if (error instanceof Anthropic.RateLimitError) {
    return Response.json({ error: "Rate limited by the model API. Try again in a minute." }, { status: 429 });
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return Response.json({ error: "Reading took too long. Try again, or use a smaller photo." }, { status: 504 });
  }
  if (error instanceof Anthropic.APIError) {
    return Response.json({ error: `Model API error ${error.status}: ${error.message}` }, { status: 502 });
  }
  if (error instanceof Anthropic.AnthropicError) {
    return Response.json({ error: "The model's answer could not be parsed. Try a clearer photo or fewer pages." }, { status: 502 });
  }
  return Response.json({ error: error instanceof Error ? error.message : "Reading failed" }, { status: 500 });
}
