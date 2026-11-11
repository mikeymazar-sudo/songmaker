"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlay";
import type { VendorId } from "@/data/types";
import type { InvoiceRecord } from "@/lib/models";
import { useApp } from "@/lib/store";
import { useInvoiceUpload } from "./useInvoiceUpload";

/** Practice invoices, one per vendor. They are made up, and every screen that shows one says so. */
export function SampleButtons({ onPick }: { onPick: (vendorId: VendorId) => void }) {
  const { state } = useApp();
  return (
    <div className="flex flex-wrap gap-2">
      {state.vendors.map((v) => (
        <Button key={v.id} variant="secondary" size="sm" onClick={() => onPick(v.id)}>
          {v.shortName}
        </Button>
      ))}
    </div>
  );
}

/**
 * Camera and file picking for invoices, usable from any screen. When photo reading is off it explains that
 * instead of opening the camera, so a photo is never taken for nothing.
 * Render `mount` once, anywhere in the component.
 */
export function useInvoiceCapture({
  onCreated,
  vendorChoice,
}: {
  onCreated: (invoice: InvoiceRecord) => void;
  vendorChoice?: VendorId | "auto";
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [offOpen, setOffOpen] = useState(false);
  const { practice } = useApp();
  const { ingest, addSample, canRead } = useInvoiceUpload({ onCreated, vendorChoice });

  const scan = () => {
    if (canRead) cameraRef.current?.click();
    else setOffOpen(true);
  };
  const choose = () => {
    if (canRead) fileRef.current?.click();
    else setOffOpen(true);
  };
  const drop = (files: FileList) => {
    if (canRead) ingest(files, "upload");
    else setOffOpen(true);
  };

  const mount = (
    <>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-label="Take a photo of an invoice"
        onChange={(e) => {
          if (e.target.files) ingest(e.target.files, "camera");
          e.target.value = "";
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        aria-label="Choose invoice files"
        onChange={(e) => {
          if (e.target.files) ingest(e.target.files, "upload");
          e.target.value = "";
        }}
      />
      <Modal
        open={offOpen}
        onClose={() => setOffOpen(false)}
        size="sm"
        title="Photo reading is off"
        footer={<Button onClick={() => setOffOpen(false)}>OK</Button>}
      >
        <div className="space-y-3 text-[15px] leading-relaxed text-text-2">
          {practice ? (
            <p>This practice copy doesn&apos;t read photos. Nothing is read or guessed from one.</p>
          ) : (
            <>
              <p>The app can&apos;t read invoice photos yet. It needs its AI key added on the server, a one-time setup (ANTHROPIC_API_KEY in Vercel).</p>
              <p>Until then nothing is read from a photo, so nothing wrong can get into your prices.</p>
            </>
          )}
          <div className="border-t border-border pt-3">
            <p className="mb-2 font-medium text-text">Try the checking screen with a practice sample</p>
            <SampleButtons
              onPick={(id) => {
                setOffOpen(false);
                addSample(id);
              }}
            />
          </div>
        </div>
      </Modal>
    </>
  );

  return { scan, choose, drop, addSample, canRead, mount };
}
