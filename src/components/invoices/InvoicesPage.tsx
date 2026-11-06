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
        title="Invoices"
        description="When a delivery arrives, snap a photo of the invoice. The AI reads every line, you check it, and your prices update when you approve. Nothing changes until you approve."
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
            { value: "review", label: "To check", count: counts.review },
            { value: "approved", label: "Approved", count: counts.approved },
            { value: "rejected", label: "Rejected", count: counts.rejected },
            { value: "all", label: "All", count: counts.all },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title={filter === "review" ? "Nothing to check" : "No invoices here"}
          description={filter === "review" ? "Add an invoice above, or practice with a sample." : "Pick another tab to see other invoices."}
        />
      ) : (
        <Card className="overflow-hidden">
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>Vendor</Th>
                  <Th>Invoice #</Th>
                  <Th className="hidden sm:table-cell">Date</Th>
                  <Th align="right" className="hidden sm:table-cell">
                    Items
                  </Th>
                  <Th align="right">Total</Th>
                  <Th className="hidden lg:table-cell" title="How sure the AI is that it read the invoice correctly">
                    AI read
                  </Th>
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
        <div className="text-[13px] text-muted sm:hidden">{fmtDate(invoice.date)}</div>
        {invoice.fileName ? <div className="hidden text-[13px] text-muted sm:block">{invoice.fileName}</div> : null}
      </Td>
      <Td className="hidden whitespace-nowrap sm:table-cell">{fmtDate(invoice.date)}</Td>
      <Td align="right" className="hidden sm:table-cell">
        {merch}
        {invoice.status === "needs-review" && (flags > 0 || unmatched > 0) ? (
          <div className="text-[12px] text-warning">
            {flags} to check
            {unmatched > 0 ? ` · ${unmatched} new` : ""}
          </div>
        ) : null}
      </Td>
      <Td align="right" className="font-medium">
        {money(invoice.total)}
      </Td>
      <Td className="hidden lg:table-cell">
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
          {invoice.status === "needs-review" ? "Check" : "Open"}
        </Button>
      </Td>
    </tr>
  );
}
