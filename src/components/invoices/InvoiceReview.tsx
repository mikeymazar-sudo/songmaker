"use client";

import { AlertTriangle, ArrowLeft, Check, CircleAlert, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ProductFormModal, type ProductFormDefaults } from "@/components/products/ProductForm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { VendorBadge } from "@/components/ui/VendorBadge";
import { CATEGORIES } from "@/data/types";
import { cn, fmtDate, fmtNum, money, pct, round2, signedPct } from "@/lib/format";
import type { ExtractedLine, InvoiceRecord } from "@/lib/models";
import { useActions, useApp } from "@/lib/store";
import { InvoicePaper } from "./InvoicePaper";
import { PROCESSING_MS } from "./ProcessingWatcher";

const STEPS = ["Reading the document", "Extracting header and line items", "Normalizing units and pack sizes", "Matching products and checking prices"];

function ProcessingCard({ invoice }: { invoice: InvoiceRecord }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = invoice.uploadedAt ? new Date(invoice.uploadedAt).getTime() : Date.now();
    const t = window.setInterval(() => setElapsed(Date.now() - started), 150);
    return () => window.clearInterval(t);
  }, [invoice.uploadedAt]);
  const real = invoice.extraction === "claude";
  const budget = real ? 20000 : PROCESSING_MS;
  const stepIndex = Math.min(STEPS.length - 1, Math.floor((elapsed / budget) * STEPS.length));
  return (
    <Card>
      <CardBody className="flex flex-col items-center gap-4 py-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand dark:text-text">
          <Sparkles className="h-7 w-7 animate-pulse" />
        </span>
        <div>
          <div className="text-lg font-semibold text-text">Reading invoice {invoice.fileName ? `“${invoice.fileName}”` : ""}</div>
          <div className="text-sm text-muted">{real ? "Claude is reading the document. Multi-page invoices can take up to a minute." : "This usually takes a few seconds per page."}</div>
        </div>
        <ol className="w-full max-w-sm space-y-2 text-left text-sm">
          {STEPS.map((s, i) => (
            <li key={s} className={cn("flex items-center gap-2", i < stepIndex ? "text-success" : i === stepIndex ? "text-text" : "text-muted")}>
              {i < stepIndex ? <Check className="h-4 w-4" /> : <span className={cn("h-4 w-4 rounded-full border-2", i === stepIndex ? "animate-spin border-brand border-t-transparent" : "border-border-strong")} />}
              {s}
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}

export function InvoiceReview({ invoiceId, onBack }: { invoiceId: string; onBack: () => void }) {
  const { state } = useApp();
  const actions = useActions();
  const { toast } = useToast();
  const invoice = state.invoices.find((i) => i.id === invoiceId);
  const vendor = invoice ? state.vendors.find((v) => v.id === invoice.vendorId) : undefined;
  const [creatingFor, setCreatingFor] = useState<ExtractedLine | null>(null);

  const summary = useMemo(() => {
    if (!invoice) return null;
    const merch = invoice.lines.filter((l) => !l.isFee);
    const unmatched = merch.filter((l) => l.matchStatus === "unmatched");
    const lowConf = merch.filter((l) => l.confidence < 0.7);
    let ups = 0;
    let downs = 0;
    let newSkus = 0;
    for (const l of merch) {
      if (!l.productId) continue;
      const vp = state.vendorProducts.find((x) => x.productId === l.productId && x.vendorId === invoice.vendorId);
      const next = l.normalizedUnitPrice ?? l.unitPrice;
      if (!vp) newSkus += 1;
      else if (next > vp.price * 1.005) ups += 1;
      else if (next < vp.price * 0.995) downs += 1;
    }
    return { merch, unmatched, lowConf, ups, downs, newSkus };
  }, [invoice, state.vendorProducts]);

  if (!invoice || !summary) {
    return (
      <Card>
        <CardBody className="py-8 text-center text-sm text-muted">That invoice is no longer available.</CardBody>
      </Card>
    );
  }
  if (invoice.status === "processing") return <ProcessingCard invoice={invoice} />;

  const editable = invoice.status === "needs-review";
  const canApprove = editable && summary.unmatched.length === 0;

  const productOptions = CATEGORIES.map((c) => ({
    category: c,
    products: state.products.filter((p) => !p.archived && p.category === c).sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.products.length > 0);

  const setMatch = (line: ExtractedLine, productId: string) => {
    if (productId === "__new__") {
      setCreatingFor(line);
      return;
    }
    if (!productId) {
      actions.updateInvoiceLine(invoice.id, line.lineId, { productId: undefined, matchStatus: "unmatched", normalizedUnitPrice: undefined, previousPrice: undefined });
      return;
    }
    const product = state.products.find((p) => p.id === productId);
    const vp = state.vendorProducts.find((x) => x.productId === productId && x.vendorId === invoice.vendorId);
    actions.updateInvoiceLine(invoice.id, line.lineId, {
      productId,
      category: product?.category,
      matchStatus: "matched",
      normalizedUnitPrice: product?.baseUnit === "case" ? line.unitPrice : (line.normalizedUnitPrice ?? line.unitPrice),
      previousPrice: vp?.price,
      flags: line.flags.filter((f) => !f.startsWith("New item")),
    });
  };

  const approve = () => {
    actions.approveInvoice(invoice.id);
    toast({
      title: `Invoice ${invoice.invoiceNumber} approved`,
      description: `${summary.merch.length} lines saved to purchasing history. ${summary.ups + summary.downs} price changes recorded.`,
    });
    onBack();
  };

  const reject = () => {
    const reason = window.prompt("Why reject this invoice? (optional)") ?? undefined;
    actions.rejectInvoice(invoice.id, reason || undefined);
    toast({ title: `Invoice ${invoice.invoiceNumber} rejected`, tone: "info" });
    onBack();
  };

  const defaults: ProductFormDefaults | undefined = creatingFor
    ? { name: titleCase(creatingFor.description), category: creatingFor.category, packSize: creatingFor.packSize, baseUnit: "case", preferredVendorId: invoice.vendorId }
    : undefined;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={onBack}>
          All invoices
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {vendor ? <VendorBadge vendor={vendor} tone="solid" /> : null}
          <span className="text-sm font-semibold text-text">Invoice #{invoice.invoiceNumber}</span>
          <StatusBadge status={invoice.status} />
          {invoice.confidence !== undefined ? <Badge tone={invoice.confidence >= 0.9 ? "success" : "warning"}>{pct(invoice.confidence, 0)} confidence</Badge> : null}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="min-w-0 max-h-[46vh] overflow-y-auto rounded-xl 2xl:sticky 2xl:top-20 2xl:max-h-none 2xl:self-start 2xl:overflow-visible">
          <InvoicePaper invoice={invoice} vendor={vendor} />
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title="Extracted header" subtitle={invoice.notes} />
            <CardBody className="grid gap-3 sm:grid-cols-4">
              <Field label="Vendor">
                <div className="flex h-11 items-center text-sm font-medium text-text">{vendor?.name}</div>
              </Field>
              <Field label="Invoice #">
                <Input value={invoice.invoiceNumber} disabled={!editable} onChange={(e) => actions.updateInvoice(invoice.id, { invoiceNumber: e.target.value })} />
              </Field>
              <Field label="Date">
                <Input type="date" value={invoice.date} disabled={!editable} onChange={(e) => actions.updateInvoice(invoice.id, { date: e.target.value })} />
              </Field>
              <Field label="Pages">
                <div className="flex h-11 items-center text-sm text-text">{invoice.pages}</div>
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={`Line items (${summary.merch.length})`}
              subtitle="Original invoice on the left, what the AI read on the right. Fix anything that's wrong, match unknown items, then approve."
            />
            <CardBody className="px-0 pb-0">
              <TableWrap className="rounded-none border-x-0 border-b-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>Description</Th>
                      <Th align="right">Qty</Th>
                      <Th align="right">Unit price</Th>
                      <Th align="right">Total</Th>
                      <Th>Master product</Th>
                      <Th>Checks</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.lines.map((line) => (
                      <LineRow key={line.lineId} line={line} invoice={invoice} editable={editable} productOptions={productOptions} onMatch={(pid) => setMatch(line, pid)} />
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
              <div className="grid gap-x-8 gap-y-1 px-5 py-4 text-sm sm:grid-cols-2">
                <div className="space-y-1">
                  <Row label="Merchandise" value={money(invoice.subtotal)} />
                  {invoice.fees > 0 ? <Row label="Delivery & fuel fees" value={money(invoice.fees)} /> : null}
                  {invoice.tax > 0 ? <Row label="Sales tax" value={money(invoice.tax)} /> : null}
                </div>
                <div className="flex flex-col justify-end sm:items-end">
                  <div className="text-xs uppercase tracking-wide text-muted">Invoice total</div>
                  <div className="tabular text-2xl font-semibold text-text">{money(invoice.total)}</div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className={cn(editable && (canApprove ? "border-success/40" : "border-warning/40"))}>
            <CardBody className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
              <div className="text-sm">
                {editable ? (
                  <>
                    <div className="font-semibold text-text">Approving this invoice will</div>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-text-2">
                      <li>
                        record {summary.merch.length} purchases for {fmtDate(invoice.date)} in your price history
                      </li>
                      <li>
                        update {vendor?.shortName} prices: {summary.ups} increase{summary.ups === 1 ? "" : "s"}, {summary.downs} decrease{summary.downs === 1 ? "" : "s"}, {summary.newSkus} new vendor SKU{summary.newSkus === 1 ? "" : "s"}
                      </li>
                      {summary.lowConf.length > 0 ? <li className="text-warning">{summary.lowConf.length} low-confidence line{summary.lowConf.length === 1 ? "" : "s"}: double-check the quantity against the paper</li> : null}
                      {summary.unmatched.length > 0 ? (
                        <li className="text-danger">
                          {summary.unmatched.length} unmatched item{summary.unmatched.length === 1 ? "" : "s"} must be matched or created first
                        </li>
                      ) : null}
                    </ul>
                  </>
                ) : invoice.status === "approved" ? (
                  <div className="text-text-2">
                    Approved {invoice.approvedAt ? fmtDate(invoice.approvedAt) : ""}. Prices from this invoice are live in the master product list.
                  </div>
                ) : (
                  <div className="text-text-2">Rejected{invoice.rejectReason ? `: ${invoice.rejectReason}` : ""}. Nothing from this invoice was saved.</div>
                )}
              </div>
              {editable ? (
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" icon={<X className="h-4 w-4" />} onClick={reject}>
                    Reject
                  </Button>
                  <Button variant="success" size="lg" icon={<Check className="h-5 w-5" />} onClick={approve} disabled={!canApprove}>
                    Approve invoice
                  </Button>
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>

      <ProductFormModal
        open={!!creatingFor}
        onClose={() => setCreatingFor(null)}
        defaults={defaults}
        onSaved={(p) => {
          if (!creatingFor) return;
          actions.updateInvoiceLine(invoice.id, creatingFor.lineId, {
            productId: p.id,
            category: p.category,
            matchStatus: "matched",
            normalizedUnitPrice: creatingFor.unitPrice,
            previousPrice: undefined,
            flags: creatingFor.flags.filter((f) => !f.startsWith("New item")),
          });
          setCreatingFor(null);
        }}
      />
    </>
  );
}

function titleCase(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((word) => {
      const letters = word.replace(/[^a-z]/gi, "");
      if (letters.length > 0 && letters.length <= 3 && !/[aeiou]/i.test(letters)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="tabular font-medium text-text">{value}</span>
    </div>
  );
}

export function StatusBadge({ status }: { status: InvoiceRecord["status"] }) {
  switch (status) {
    case "processing":
      return <Badge tone="info" dot>Reading…</Badge>;
    case "needs-review":
      return <Badge tone="warning" dot>Needs review</Badge>;
    case "approved":
      return <Badge tone="success">Approved</Badge>;
    case "rejected":
      return <Badge tone="danger">Rejected</Badge>;
  }
}

function LineRow({
  line,
  invoice,
  editable,
  productOptions,
  onMatch,
}: {
  line: ExtractedLine;
  invoice: InvoiceRecord;
  editable: boolean;
  productOptions: Array<{ category: string; products: Array<{ id: string; name: string }> }>;
  onMatch: (productId: string) => void;
}) {
  const actions = useActions();
  const { state } = useApp();
  const product = line.productId ? state.products.find((p) => p.id === line.productId) : undefined;
  const low = line.confidence < 0.7;
  const unmatched = !line.isFee && line.matchStatus === "unmatched";
  const delta = line.previousPrice && line.normalizedUnitPrice ? (line.normalizedUnitPrice - line.previousPrice) / line.previousPrice : 0;

  if (line.isFee) {
    return (
      <tr className="bg-surface-2/60 text-muted">
        <Td className="whitespace-normal">
          <div className="text-sm">{line.description}</div>
          {line.flags.map((f) => (
            <div key={f} className="text-xs text-warning">{f}</div>
          ))}
        </Td>
        <Td align="right">—</Td>
        <Td align="right">—</Td>
        <Td align="right">{money(line.total)}</Td>
        <Td><span className="text-xs">Fee</span></Td>
        <Td><Badge tone="neutral">{pct(line.confidence, 0)}</Badge></Td>
      </tr>
    );
  }

  return (
    <tr className={cn(unmatched ? "bg-danger-soft/40" : low ? "bg-warning-soft/40" : undefined)}>
      <Td className="min-w-56 whitespace-normal">
        <div className="text-sm font-medium text-text">{line.description}</div>
        <div className="text-xs text-muted">
          <span className="font-mono">{line.sku}</span> · {line.packSize}
        </div>
      </Td>
      <Td align="right">
        {editable ? (
          <Input
            type="number"
            inputMode="decimal"
            value={line.qty}
            onChange={(e) => actions.updateInvoiceLine(invoice.id, line.lineId, { qty: Math.max(0, Number(e.target.value) || 0) })}
            className={cn("h-9 w-20 text-right", low && "border-warning")}
            aria-label="Quantity"
          />
        ) : (
          fmtNum(line.qty)
        )}
      </Td>
      <Td align="right">
        {editable ? (
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={line.unitPrice}
            onChange={(e) => {
              const unitPrice = Math.max(0, Number(e.target.value) || 0);
              const ratio = line.unitPrice > 0 ? unitPrice / line.unitPrice : 1;
              actions.updateInvoiceLine(invoice.id, line.lineId, {
                unitPrice,
                normalizedUnitPrice: line.normalizedUnitPrice !== undefined ? round2(line.normalizedUnitPrice * ratio) : undefined,
              });
            }}
            className="h-9 w-24 text-right"
            aria-label="Unit price"
          />
        ) : (
          money(line.unitPrice)
        )}
      </Td>
      <Td align="right" className="font-medium">
        {money(line.total)}
      </Td>
      <Td className="min-w-56">
        {editable ? (
          <Select value={line.productId ?? ""} onChange={(e) => onMatch(e.target.value)} className={cn("h-9 text-xs", unmatched && "border-danger")} aria-label="Master product">
            <option value="">— Not matched —</option>
            <option value="__new__">＋ Create new master product…</option>
            {productOptions.map((g) => (
              <optgroup key={g.category} label={g.category}>
                {g.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        ) : (
          <span className="text-sm text-text">{product?.name ?? <span className="text-muted">Not matched</span>}</span>
        )}
        {product && line.matchStatus === "suggested" ? <div className="mt-0.5 text-[11px] text-warning">Suggested match, please confirm</div> : null}
      </Td>
      <Td className="whitespace-normal">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={low ? "warning" : "neutral"} title="Extraction confidence">{pct(line.confidence, 0)}</Badge>
          {line.previousPrice !== undefined && Math.abs(delta) > 0.005 ? (
            <Badge tone={delta > 0 ? "danger" : "success"} title={`Was ${money(line.previousPrice)}`}>
              {signedPct(delta)}
            </Badge>
          ) : null}
          {unmatched ? (
            <span className="inline-flex items-center gap-1 text-xs text-danger"><CircleAlert className="h-3.5 w-3.5" /> New item</span>
          ) : null}
          {low ? (
            <span className="inline-flex items-center gap-1 text-xs text-warning"><AlertTriangle className="h-3.5 w-3.5" /> Check qty</span>
          ) : null}
        </div>
      </Td>
    </tr>
  );
}
