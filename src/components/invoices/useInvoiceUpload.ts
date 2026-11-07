"use client";

import { useToast } from "@/components/ui/Toast";
import type { VendorId } from "@/data/types";
import { buildPendingInvoice, finalizeExtraction, type ExtractResponse } from "@/lib/extractClient";
import { pct } from "@/lib/format";
import { prepareUpload } from "@/lib/imagePrep";
import type { InvoiceRecord } from "@/lib/models";
import { simulateExtraction } from "@/lib/simulateOcr";
import { useActions, useApp } from "@/lib/store";
import { setPreview } from "./previewStore";

const KEYWORDS: Array<[VendorId, RegExp]> = [
  ["cheney", /cheney|cbi/i],
  ["sysco", /sysco/i],
  ["usfoods", /us ?foods|usf/i],
  ["trs", /restaurant ?store|trs|webstaurant/i],
  ["boomers", /boomer/i],
];

/** Sends invoice files or photos to be read, from any screen. Reading keeps going if the screen changes. */
export function useInvoiceUpload({
  onCreated,
  vendorChoice = "auto",
}: {
  onCreated: (invoice: InvoiceRecord) => void;
  vendorChoice?: VendorId | "auto";
}) {
  const { state, extractionEnabled } = useApp();
  const actions = useActions();
  const { toast } = useToast();

  const guessVendor = (name: string): VendorId => {
    if (vendorChoice !== "auto") return vendorChoice;
    const hit = KEYWORDS.find(([, re]) => re.test(name));
    if (hit) return hit[0];
    const counts = state.vendors.map((v) => ({ id: v.id, n: state.invoices.filter((i) => i.vendorId === v.id).length }));
    return counts.sort((a, b) => b.n - a.n)[0]?.id ?? "cheney";
  };

  const runExtraction = async (file: File, source: InvoiceRecord["source"]) => {
    const guessed = guessVendor(file.name);
    const pending = buildPendingInvoice(guessed, source, file.name);
    setPreview(pending.id, file);
    actions.addInvoice(pending);
    onCreated(pending);

    if (!extractionEnabled) {
      const sim = simulateExtraction(state, guessed, source, file.name);
      actions.updateInvoice(pending.id, {
        ...sim,
        id: pending.id,
        lines: sim.lines.map((l, i) => ({ ...l, lineId: `${pending.id}-l${i + 1}` })),
        extraction: "simulated",
        notes: "Practice mode: this was simulated. Add ANTHROPIC_API_KEY on the server to read real invoices.",
      });
      return;
    }

    try {
      const prepared = await prepareUpload(file);
      const body = new FormData();
      body.append("file", prepared, prepared.name);
      if (vendorChoice !== "auto") body.append("vendorId", vendorChoice);
      const res = await fetch("/api/extract", { method: "POST", body });
      if (!res.ok) {
        let message = `Extraction failed (${res.status})`;
        try {
          message = ((await res.json()) as { error?: string }).error ?? message;
        } catch {
          // keep default
        }
        actions.rejectInvoice(pending.id, message);
        toast({ title: "Couldn't read that invoice", description: message, tone: "danger" });
        return;
      }
      const data = (await res.json()) as ExtractResponse;
      const patch = finalizeExtraction(state, pending, data, vendorChoice === "auto" ? undefined : vendorChoice);
      const merch = (patch.lines ?? []).filter((l) => !l.isFee).length;
      const unmatched = (patch.lines ?? []).filter((l) => !l.isFee && l.matchStatus === "unmatched").length;
      actions.updateInvoice(
        pending.id,
        patch,
        `Claude read invoice ${patch.invoiceNumber ?? ""}: ${merch} lines, ${unmatched} unmatched item${unmatched === 1 ? "" : "s"}, ${pct(patch.confidence ?? 0, 0)} average confidence`,
      );
      toast({ title: "Invoice read", description: `Found ${merch} items. Check them, then approve.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      actions.rejectInvoice(pending.id, message);
      toast({ title: "Couldn't read that invoice", description: message, tone: "danger" });
    }
  };

  const ingest = (files: FileList | File[], source: InvoiceRecord["source"]) => {
    const list = Array.from(files).slice(0, 4);
    if (list.length === 0) return;
    toast({
      title: list.length === 1 ? "Invoice uploaded" : `${list.length} invoices uploaded`,
      description: extractionEnabled ? "The AI is reading it and matching your products…" : "Practice mode: simulating the read…",
      tone: "info",
    });
    for (const file of list) void runExtraction(file, source);
  };

  return { ingest };
}
