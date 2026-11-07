"use client";

import { Camera, ChevronDown, FileUp } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import type { VendorId } from "@/data/types";
import { cn } from "@/lib/format";
import type { InvoiceRecord } from "@/lib/models";
import { simulateExtraction } from "@/lib/simulateOcr";
import { useActions, useApp } from "@/lib/store";
import { useInvoiceUpload } from "./useInvoiceUpload";

export function UploadPanel({ onCreated }: { onCreated: (invoice: InvoiceRecord) => void }) {
  const { state, extractionEnabled } = useApp();
  const actions = useActions();
  const { toast } = useToast();
  const [vendorChoice, setVendorChoice] = useState<VendorId | "auto">("auto");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const { ingest } = useInvoiceUpload({ onCreated, vendorChoice });

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
