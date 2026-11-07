"use client";

import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/lib/store";
import { useInvoiceUpload } from "./useInvoiceUpload";

/** Opens the camera right away, then lands on the new invoice to check it. */
export function TakeInvoicePhoto({ className }: { className?: string }) {
  const { setUi } = useApp();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { ingest } = useInvoiceUpload({
    onCreated: (invoice) => {
      setUi({ selectedInvoiceId: invoice.id, nonce: Date.now() });
      router.push("/invoices");
    },
  });

  return (
    <>
      <Button variant="outline" className={className} icon={<Camera className="h-5 w-5" strokeWidth={1.75} />} onClick={() => inputRef.current?.click()}>
        Take invoice photo
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-label="Take invoice photo"
        onChange={(e) => {
          if (e.target.files) ingest(e.target.files, "camera");
          e.target.value = "";
        }}
      />
    </>
  );
}
