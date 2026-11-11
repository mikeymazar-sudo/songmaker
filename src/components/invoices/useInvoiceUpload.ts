"use client";

import { useToast } from "@/components/ui/Toast";
import type { VendorId } from "@/data/types";
import { buildPendingInvoice, finalizeExtraction, type ExtractResponse, type SecondReadResponse, type SecondReadResult } from "@/lib/extractClient";
import { prepareUpload } from "@/lib/imagePrep";
import { auditInvoice } from "@/lib/invoiceAudit";
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

async function errorOf(res: Response, fallback: string): Promise<string> {
  try {
    return ((await res.json()) as { error?: string }).error ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Sends invoice files or photos to be read, from any screen. Every invoice is read twice, separately and at
 * the same time; the two reads are compared before the owner sees anything. Reading keeps going if the screen changes.
 */
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

  const readTwice = async (file: File, source: InvoiceRecord["source"]) => {
    const pending = buildPendingInvoice(guessVendor(file.name), source, file.name);
    setPreview(pending.id, file);
    actions.addInvoice(pending);
    onCreated(pending);

    const fail = (message: string) => {
      actions.rejectInvoice(pending.id, message);
      toast({ title: "Couldn't read that invoice", description: message, tone: "danger" });
    };

    try {
      const prepared = await prepareUpload(file);
      const send = (path: string) => {
        const body = new FormData();
        body.append("file", prepared, prepared.name);
        if (vendorChoice !== "auto") body.append("vendorId", vendorChoice);
        return fetch(path, { method: "POST", body });
      };
      const [firstRes, secondRes] = await Promise.allSettled([send("/api/extract"), send("/api/extract/verify")]);

      if (firstRes.status === "rejected") return fail(firstRes.reason instanceof Error ? firstRes.reason.message : "Network error");
      if (!firstRes.value.ok) return fail(await errorOf(firstRes.value, `Reading failed (${firstRes.value.status})`));
      const first = (await firstRes.value.json()) as ExtractResponse;

      let second: SecondReadResult;
      if (secondRes.status === "rejected") second = { error: secondRes.reason instanceof Error ? secondRes.reason.message : "Network error" };
      else if (!secondRes.value.ok) second = { error: await errorOf(secondRes.value, `Second read failed (${secondRes.value.status})`) };
      else second = { read: ((await secondRes.value.json()) as SecondReadResponse).read };

      const patch = finalizeExtraction(state, pending, first, vendorChoice === "auto" ? undefined : vendorChoice, second);
      const lines = patch.lines ?? [];
      const merch = lines.filter((l) => !l.isFee).length;
      const read = patch.verification?.secondRead;
      const log = read
        ? `Invoice ${patch.invoiceNumber ?? ""} read twice: ${merch} items. The reads agreed on ${read.confirmed} lines, the math fixed ${read.corrected}, ${read.unsure} left for the owner${read.added > 0 ? `, ${read.added} found only on the second read` : ""}.`
        : `Invoice ${patch.invoiceNumber ?? ""} read once: ${merch} items. The second read did not finish (${"error" in second ? second.error : "unknown"}).`;
      actions.updateInvoice(pending.id, patch, log);
      const audit = auditInvoice(state, { ...pending, ...patch });
      toast(
        audit.status === "pass"
          ? { title: "Invoice read and checked", description: `${merch} items. Everything matches.` }
          : { title: read ? "Invoice read twice" : "Invoice read once", description: `${audit.headline}.`.replace(/\.\.$/, "."), tone: "info" },
      );
    } catch (err) {
      fail(err instanceof Error ? err.message : "Network error");
    }
  };

  /** Returns false, and reads nothing, when photo reading is off. A photo is never filled in with made-up numbers. */
  const ingest = (files: FileList | File[], source: InvoiceRecord["source"]): boolean => {
    const list = Array.from(files).slice(0, 4);
    if (list.length === 0) return false;
    if (!extractionEnabled) {
      toast({ title: "Photo reading is off", description: "Nothing was read. The app needs its AI key before it can read invoices.", tone: "danger" });
      return false;
    }
    toast({
      title: list.length === 1 ? "Reading your invoice" : `Reading ${list.length} invoices`,
      description: "Each one is read twice and checked against its total.",
      tone: "info",
    });
    for (const file of list) void readTwice(file, source);
    return true;
  };

  /** A made-up invoice built from a vendor's last real one, for trying the review screen. */
  const addSample = (vendorId: VendorId) => {
    const invoice = simulateExtraction(state, vendorId, "sample", `${vendorId}-sample.jpg`);
    actions.addInvoice(invoice);
    onCreated(invoice);
    toast({ title: "Practice sample added", description: "Made-up numbers, for trying the checking screen.", tone: "info" });
  };

  return { ingest, addSample, canRead: extractionEnabled };
}
