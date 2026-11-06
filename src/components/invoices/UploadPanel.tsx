"use client";

import { Camera, FileUp, Sparkles, Upload } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
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
        notes: "Simulated extraction: add ANTHROPIC_API_KEY on the server to read real documents.",
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
      toast({ title: "Invoice read", description: `${merch} line items extracted. Review and approve.` });
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
      description: extractionEnabled ? "Claude is reading the document and matching products…" : "Simulated extraction is running…",
      tone: "info",
    });
    for (const file of list) void runExtraction(file, source);
  };

  const sample = (vendorId: VendorId) => {
    const inv = simulateExtraction(state, vendorId, "sample", `${vendorId}-sample.jpg`);
    actions.addInvoice(inv);
    onCreated(inv);
    toast({ title: "Sample invoice queued", description: "A simulated delivery based on this vendor's last real invoice.", tone: "info" });
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) ingest(e.dataTransfer.files, "upload");
  };

  return (
    <Card>
      <CardBody className="grid gap-4 py-5 lg:grid-cols-[1fr_320px]">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
            dragging ? "border-brand bg-brand-soft" : "border-border-strong bg-surface-2",
          )}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand dark:text-text">
            <Upload className="h-6 w-6" />
          </span>
          <h3 className="mt-3 text-base font-semibold text-text">Drop invoices here</h3>
          <p className="mt-1 max-w-sm text-sm text-muted">
            PDF or photos, up to four at once. Claude reads the header and every line item, matches each line to your master products, and hands it to you for approval.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button icon={<FileUp className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>
              Choose files
            </Button>
            <Button variant="outline" icon={<Camera className="h-4 w-4" />} onClick={() => cameraRef.current?.click()}>
              Take a photo
            </Button>
          </div>
          <div className="mt-3">
            {extractionEnabled ? (
              <Badge tone="success" dot>Real extraction on</Badge>
            ) : (
              <Badge tone="warning" dot title="Add ANTHROPIC_API_KEY on the server to read real documents">
                Simulated extraction
              </Badge>
            )}
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
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Vendor</label>
            <Select value={vendorChoice} onChange={(e) => setVendorChoice(e.target.value as VendorId | "auto")}>
              <option value="auto">Detect from the document</option>
              {state.vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <Sparkles className="h-3.5 w-3.5" /> Try a sample delivery
            </div>
            <div className="flex flex-wrap gap-2">
              {state.vendors.map((v) => (
                <Button key={v.id} variant="outline" size="sm" onClick={() => sample(v.id)}>
                  {v.shortName}
                </Button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">Samples are simulated from the vendor&apos;s last real invoice, with a few price changes and one new item, so you can practice the review flow.</p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
