// In-memory object URLs for uploaded images (not persisted; used for the "original document" pane).
const previews = new Map<string, string>();

export function setPreview(invoiceId: string, file: File | null): void {
  if (!file || !file.type.startsWith("image/")) return;
  previews.set(invoiceId, URL.createObjectURL(file));
}

export function getPreview(invoiceId: string): string | undefined {
  return previews.get(invoiceId);
}
