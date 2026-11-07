"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { List, Row } from "@/components/ui/List";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { fmtDate, money } from "@/lib/format";
import type { InvoiceRecord } from "@/lib/models";
import { useApp } from "@/lib/store";
import { InvoiceReview, StatusBadge } from "./InvoiceReview";
import { UploadPanel } from "./UploadPanel";

type Filter = "review" | "approved" | "rejected" | "all";

export function InvoicesPage() {
  const { state, ui, setUi } = useApp();
  const [filter, setFilter] = useState<Filter>(() =>
    state.invoices.some((i) => i.status === "needs-review" || i.status === "processing") ? "review" : "all",
  );
  const [selectedId, setSelectedId] = useState<string | null>(ui.selectedInvoiceId);
  const [seenNonce, setSeenNonce] = useState(ui.nonce);

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
    return <InvoiceReview invoiceId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <>
      <PageHeader title="Invoices" description="Snap it. Prices update when you approve." />
      <UploadPanel
        onCreated={(inv) => {
          setFilter("review");
          setSelectedId(inv.id);
        }}
      />

      <Tabs<Filter>
        className="mt-8"
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
          description={filter === "review" ? "Add an invoice above when a delivery arrives." : "Pick another tab to see other invoices."}
        />
      ) : (
        <List>
          {rows.map((i) => (
            <InvoiceRow key={i.id} invoice={i} onOpen={() => setSelectedId(i.id)} />
          ))}
        </List>
      )}
    </>
  );
}

function InvoiceRow({ invoice, onOpen }: { invoice: InvoiceRecord; onOpen: () => void }) {
  const { state } = useApp();
  const vendor = state.vendors.find((v) => v.id === invoice.vendorId);
  return (
    <li>
      <Row
        onClick={onOpen}
        title={vendor?.name ?? invoice.vendorId}
        subtitle={`#${invoice.invoiceNumber} · ${fmtDate(invoice.date)}`}
        value={money(invoice.total)}
        detail={<StatusBadge status={invoice.status} />}
      />
    </li>
  );
}
