"use client";

import { Camera, ChevronDown, FileUp } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import type { VendorId } from "@/data/types";
import { buildPendingInvoice, finalizeExtraction, type ExtractResponse } from "@/lib/extractClient";
import { cn, pct } from "@/lib/format";
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

export function UploadPanel({ onCreated }: { onCreated: (invoice: InvoiceRecord) => void }) {
  const { state, extractionEnabled } = useApp();
  const actions = useActions();
  const { toast } = useToast();
  const [vendorChoice, setVendorChoice] = useState<VendorId | "auto">("auto");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

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

  const sample = (vendorId: VendorId) => {
    const inv = simulateExtraction(state, vendorId, "sample", `${vendorId}-sample.jpg`);
    actions.addInvoice(inv);
    onCreated(inv);
    toast({ title: "Sample invoice added", description: "A practice copy of this vendor's last real invoice.", tone: "info" });
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) ingest(e.dataTransfer.files, "upload");
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn("rounded-2xl transition-colors", dragging && "bg-surface-3 outline-2 outline-offset-8 outline-text outline-dashed")}
    >
      <div className="grid grid-cols-2 gap-2.5 md:flex">
        <Button icon={<Camera className="h-5 w-5" strokeWidth={1.75} />} onClick={() => cameraRef.current?.click()}>
          Take a photo
        </Button>
        <Button variant="outline" icon={<FileUp className="h-5 w-5" strokeWidth={1.75} />} onClick={() => fileRef.current?.click()}>
          Choose files
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) ingest(e.target.files, "upload");
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) ingest(e.target.files, "camera");
          e.target.value = "";
        }}
      />
      <p className="mt-3 text-[13px] text-muted">
        <span className="hidden md:inline">Or drop up to four files here. </span>
        {extractionEnabled ? "AI reading is on." : "Practice mode: invoices are simulated."}
      </p>

      <details className="group mt-2">
        <summary className="flex h-10 cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-text-2">
          More options
          <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-1 grid gap-4 pb-1 md:grid-cols-2">
          <div>
            <label htmlFor="upload-vendor" className="mb-1.5 block text-sm font-medium text-text-2">
              Vendor
            </label>
            <Select id="upload-vendor" value={vendorChoice} onChange={(e) => setVendorChoice(e.target.value as VendorId | "auto")}>
              <option value="auto">Figure it out from the invoice</option>
              {state.vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <div className="mb-1.5 text-sm font-medium text-text-2">Practice with a sample</div>
            <div className="flex flex-wrap gap-2">
              {state.vendors.map((v) => (
                <Button key={v.id} variant="secondary" size="sm" onClick={() => sample(v.id)}>
                  {v.shortName}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
