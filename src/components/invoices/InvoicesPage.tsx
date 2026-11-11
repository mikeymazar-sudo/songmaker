"use client";

import { ChevronDown, FileUp, ScanLine } from "lucide-react";
import { useEffect, useMemo, useState, type DragEvent } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Field";
import { List, Row } from "@/components/ui/List";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Tabs } from "@/components/ui/Tabs";
import type { VendorId } from "@/data/types";
import { cn, fmtDate, money } from "@/lib/format";
import { auditInvoice } from "@/lib/invoiceAudit";
import type { AppState, InvoiceRecord } from "@/lib/models";
import { useApp } from "@/lib/store";
import { SampleButtons, useInvoiceCapture } from "./InvoiceCapture";
import { InvoiceReview, readWasCutOff } from "./InvoiceReview";

type Filter = "review" | "approved" | "rejected" | "all";

/** Where an invoice stands, in two or three words. */
export function invoiceStanding(state: AppState, invoice: InvoiceRecord): { label: string; tone: BadgeTone } {
  if (readWasCutOff(invoice)) return { label: "Cut off", tone: "danger" };
  if (invoice.status === "processing") return { label: "Reading…", tone: "neutral" };
  if (invoice.status === "approved") return { label: "Approved", tone: "success" };
  if (invoice.status === "rejected") return { label: "Rejected", tone: "neutral" };
  const audit = auditInvoice(state, invoice);
  if (audit.status === "pass") return { label: "Ready to approve", tone: "success" };
  if (invoice.extraction === "simulated") return { label: invoice.source === "sample" ? "Practice sample" : "Not your photo", tone: invoice.source === "sample" ? "warning" : "danger" };
  if (audit.attention > 0) return { label: `${audit.attention} to check`, tone: "warning" };
  return { label: audit.status === "fail" ? "Has a problem" : "Needs a look", tone: audit.status === "fail" ? "danger" : "warning" };
}

export function InvoicesPage() {
  const { state, ui, setUi } = useApp();
  const [filter, setFilter] = useState<Filter>(() =>
    state.invoices.some((i) => i.status === "needs-review" || i.status === "processing") ? "review" : "all",
  );
  const [selectedId, setSelectedId] = useState<string | null>(ui.selectedInvoiceId);
  const [seenNonce, setSeenNonce] = useState(ui.nonce);
  const [vendorChoice, setVendorChoice] = useState<VendorId | "auto">("auto");
  const [dragging, setDragging] = useState(false);
  const capture = useInvoiceCapture({
    vendorChoice,
    onCreated: (inv) => {
      setFilter("review");
      setSelectedId(inv.id);
    },
  });

  if (ui.nonce !== seenNonce) {
    setSeenNonce(ui.nonce);
    setSelectedId(ui.selectedInvoiceId);
  }

  useEffect(() => {
    if (ui.selectedInvoiceId) setUi({ selectedInvoiceId: null });
  }, [ui.selectedInvoiceId, setUi]);

  const counts = useMemo(
    () => ({
      review: state.invoices.filter((i) => i.status === "needs-review" || i.status === "processing").length,
      approved: state.invoices.filter((i) => i.status === "approved").length,
      rejected: state.invoices.filter((i) => i.status === "rejected").length,
      all: state.invoices.length,
    }),
    [state.invoices],
  );

  const rows = useMemo(() => {
    const list = state.invoices.filter((i) => {
      if (filter === "review") return i.status === "needs-review" || i.status === "processing";
      if (filter === "all") return true;
      return i.status === filter;
    });
    return [...list].sort((a, b) => {
      const ta = a.uploadedAt ?? `${a.date}T00:00:00.000Z`;
      const tb = b.uploadedAt ?? `${b.date}T00:00:00.000Z`;
      return ta < tb ? 1 : -1;
    });
  }, [state.invoices, filter]);

  if (selectedId) {
    return (
      <>
        {capture.mount}
        <InvoiceReview invoiceId={selectedId} onBack={() => setSelectedId(null)} />
      </>
    );
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) capture.drop(e.dataTransfer.files);
  };

  return (
    <>
      {capture.mount}
      <PageHeader title="Invoices" description="Scan a delivery invoice. The app reads it twice and checks the math before you approve." />

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
          <Button icon={<ScanLine className="h-5 w-5" strokeWidth={1.75} />} onClick={capture.scan}>
            Scan invoice
          </Button>
          <Button variant="outline" icon={<FileUp className="h-5 w-5" strokeWidth={1.75} />} onClick={capture.choose}>
            Upload file
          </Button>
        </div>

        {capture.canRead ? (
          <p className="mt-3 text-[13px] text-muted">
            Photo reading is on.<span className="hidden md:inline"> You can also drop up to four files here.</span>
          </p>
        ) : (
          <Panel tone="warn" className="mt-4">
            <p className="text-[15px] font-semibold text-text">Photo reading is off</p>
            <p className="mt-1 text-[15px] leading-relaxed text-text-2">
              The app can&apos;t read invoice photos until its AI key is added on the server. Nothing is read or guessed from a photo until then.
            </p>
          </Panel>
        )}

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
              <div className="mb-1.5 text-sm font-medium text-text-2">Practice with a made-up sample</div>
              <SampleButtons onPick={capture.addSample} />
            </div>
          </div>
        </details>
      </div>

      <Tabs<Filter>
        className="mt-6"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "review", label: "To check", count: counts.review },
          { value: "approved", label: "Approved", count: counts.approved },
          { value: "rejected", label: "Rejected", count: counts.rejected },
          { value: "all", label: "All", count: counts.all },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState
          title={filter === "review" ? "Nothing to check" : "No invoices here"}
          description={filter === "review" ? "Scan an invoice when a delivery arrives." : "Pick another tab to see other invoices."}
        />
      ) : (
        <List>
          {rows.map((i) => {
            const vendor = state.vendors.find((v) => v.id === i.vendorId);
            const standing = invoiceStanding(state, i);
            return (
              <li key={i.id}>
                <Row
                  onClick={() => setSelectedId(i.id)}
                  title={vendor?.name ?? i.vendorId}
                  subtitle={i.status === "processing" ? (readWasCutOff(i) ? "Scan it again" : "Reading it twice…") : `#${i.invoiceNumber} · ${fmtDate(i.date)}`}
                  value={i.status === "processing" ? undefined : money(i.total)}
                  detail={<Badge tone={standing.tone}>{standing.label}</Badge>}
                />
              </li>
            );
          })}
        </List>
      )}
    </>
  );
}
