"use client";

import { FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { VendorBadge } from "@/components/ui/VendorBadge";
import { fmtDate, money, pct } from "@/lib/format";
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
      <PageHeader
        title="Upload & Review Invoices"
        description="Every delivery ticket goes through the same path: upload, AI extraction, your review, then approval into price history. Nothing is saved until you approve it."
      />
      <UploadPanel
        onCreated={(inv) => {
          setFilter("review");
          setSelectedId(inv.id);
        }}
      />

      <div className="mt-6 mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "review", label: "Needs review", count: counts.review },
            { value: "approved", label: "Approved", count: counts.approved },
            { value: "rejected", label: "Rejected", count: counts.rejected },
            { value: "all", label: "All", count: counts.all },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title={filter === "review" ? "Nothing waiting for review" : "No invoices here"}
          description={filter === "review" ? "Upload a delivery ticket or try a sample above." : "Change the filter to see other invoices."}
        />
      ) : (
        <Card className="overflow-hidden">
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>Vendor</Th>
                  <Th>Invoice</Th>
                  <Th>Date</Th>
                  <Th align="right">Lines</Th>
                  <Th align="right">Total</Th>
                  <Th>Confidence</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <InvoiceRow key={i.id} invoice={i} onOpen={() => setSelectedId(i.id)} />
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      )}
    </>
  );
}

function InvoiceRow({ invoice, onOpen }: { invoice: InvoiceRecord; onOpen: () => void }) {
  const { state } = useApp();
  const vendor = state.vendors.find((v) => v.id === invoice.vendorId);
  const merch = invoice.lines.filter((l) => !l.isFee).length;
  const flags = invoice.lines.reduce((s, l) => s + l.flags.length, 0);
  const unmatched = invoice.lines.filter((l) => !l.isFee && l.matchStatus === "unmatched").length;
  return (
    <tr onClick={onOpen} className="cursor-pointer hover:bg-surface-2/70">
      <Td>{vendor ? <VendorBadge vendor={vendor} tone="plain" /> : invoice.vendorId}</Td>
      <Td>
        <div className="font-medium text-text">#{invoice.invoiceNumber}</div>
        {invoice.fileName ? <div className="text-xs text-muted">{invoice.fileName}</div> : null}
      </Td>
      <Td className="whitespace-nowrap">{fmtDate(invoice.date)}</Td>
      <Td align="right">
        {merch}
        {invoice.status === "needs-review" && (flags > 0 || unmatched > 0) ? (
          <div className="text-[11px] text-warning">
            {flags} flag{flags === 1 ? "" : "s"}
            {unmatched > 0 ? ` · ${unmatched} new` : ""}
          </div>
        ) : null}
      </Td>
      <Td align="right" className="font-medium">
        {money(invoice.total)}
      </Td>
      <Td>
        {invoice.confidence !== undefined ? (
          <Badge tone={invoice.confidence >= 0.9 ? "success" : "warning"}>{pct(invoice.confidence, 0)}</Badge>
        ) : (
          <span className="text-muted">—</span>
        )}
      </Td>
      <Td>
        <StatusBadge status={invoice.status} />
      </Td>
      <Td>
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
          {invoice.status === "needs-review" ? "Review" : "View"}
        </Button>
      </Td>
    </tr>
  );
}
