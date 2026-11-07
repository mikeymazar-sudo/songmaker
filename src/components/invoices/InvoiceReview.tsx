"use client";

import { ArrowLeft, Check, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ProductFormModal, type ProductFormDefaults } from "@/components/products/ProductForm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Section } from "@/components/ui/List";
import { useToast } from "@/components/ui/Toast";
import { CATEGORIES, type VendorId } from "@/data/types";
import { cn, fmtDate, fmtNum, money, pct, round2, signedPct } from "@/lib/format";
import type { ExtractedLine, InvoiceRecord } from "@/lib/models";
import { useActions, useApp } from "@/lib/store";
import { InvoicePaper } from "./InvoicePaper";
import { PROCESSING_MS } from "./ProcessingWatcher";

const STEPS = [
  "Reading the invoice",
  "Finding the vendor, date and each item",
  "Working out pack sizes",
  "Matching your products and checking prices",
];

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
    <div className="mx-auto max-w-sm py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-text">Reading your invoice</h1>
      <p className="mt-1 text-[15px] text-muted">
        {real ? "This can take up to a minute for invoices with several pages." : "This usually takes a few seconds."}
      </p>
      <ol className="mt-6 space-y-3 text-[15px]">
        {STEPS.map((s, i) => (
          <li key={s} className={cn("flex items-center gap-3", i < stepIndex ? "text-success" : i === stepIndex ? "text-text" : "text-muted")}>
            {i < stepIndex ? (
              <Check className="h-4 w-4 shrink-0" />
            ) : (
              <span
                className={cn("h-4 w-4 shrink-0 rounded-full border-2", i === stepIndex ? "animate-spin border-text border-t-transparent" : "border-border-strong")}
              />
            )}
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function InvoiceReview({ invoiceId, onBack }: { invoiceId: string; onBack: () => void }) {
  const { state } = useApp();
  const actions = useActions();
  const { toast } = useToast();
  const invoice = state.invoices.find((i) => i.id === invoiceId);
  const vendor = invoice ? state.vendors.find((v) => v.id === invoice.vendorId) : undefined;
  const [creatingFor, setCreatingFor] = useState<ExtractedLine | null>(null);
  const [showPaper, setShowPaper] = useState(false);

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
    return <p className="py-10 text-center text-[15px] text-muted">That invoice is no longer available.</p>;
  }
  if (invoice.status === "processing") return <ProcessingCard invoice={invoice} />;

  const editable = invoice.status === "needs-review";
  const badPrices = invoice.lines.filter(
    (l) => !l.isFee && (!(l.unitPrice > 0) || (l.productId && !((l.normalizedUnitPrice ?? l.unitPrice) > 0))),
  );
  const canApprove = editable && summary.unmatched.length === 0 && badPrices.length === 0;

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
      actions.updateInvoiceLine(invoice.id, line.lineId, {
        productId: undefined,
        matchStatus: "unmatched",
        normalizedUnitPrice: undefined,
        previousPrice: undefined,
      });
      return;
    }
    const product = state.products.find((p) => p.id === productId);
    const vp = state.vendorProducts.find((x) => x.productId === productId && x.vendorId === invoice.vendorId);
    // Per case: the billed price is the base-unit price. Otherwise keep the model's normalization if it
    // exists; if not, start from the billed price and ask the reviewer to confirm the per-unit figure.
    const factor =
      product?.baseUnit === "case"
        ? 1
        : (line.normalizationFactor ?? (line.unitPrice > 0 && line.normalizedUnitPrice ? line.normalizedUnitPrice / line.unitPrice : 1));
    const flags = line.flags.filter((f) => !f.startsWith("New item") && !f.startsWith("Confirm the price per"));
    if (product && product.baseUnit !== "case" && factor === 1) flags.push(`Confirm the price per ${product.baseUnit}`);
    actions.updateInvoiceLine(invoice.id, line.lineId, {
      productId,
      category: product?.category,
      matchStatus: "matched",
      normalizedUnitPrice: round2(line.unitPrice * factor),
      normalizationFactor: factor,
      previousPrice: vp?.price,
      flags,
    });
  };

  const approve = () => {
    if (invoice.extraction === "simulated" || invoice.source === "sample") {
      const ok = window.confirm(
        "This is a simulated sample, not a real delivery. Approving writes its prices into your real catalog. Continue?",
      );
      if (!ok) return;
    }
    actions.approveInvoice(invoice.id);
    toast({
      title: `Invoice ${invoice.invoiceNumber} approved`,
      description: `${summary.merch.length} items saved. ${summary.ups + summary.downs} prices updated.`,
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
    ? {
        name: titleCase(creatingFor.description),
        category: creatingFor.category,
        packSize: creatingFor.packSize,
        baseUnit: "case",
        preferredVendorId: invoice.vendorId,
      }
    : undefined;

  return (
    <>
      <button type="button" onClick={onBack} className="-ml-1 mb-3 flex h-10 items-center gap-1.5 text-[15px] font-medium text-text-2">
        <ArrowLeft className="h-4 w-4" />
        Invoices
      </button>

      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-[28px] font-semibold leading-tight tracking-tight text-text md:text-[32px]">{vendor?.shortName ?? invoice.vendorId}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[15px] text-muted">
            <span>#{invoice.invoiceNumber}</span>
            <StatusBadge status={invoice.status} />
            {invoice.confidence !== undefined ? (
              <Badge tone={invoice.confidence >= 0.9 ? "neutral" : "warning"} title="How sure the AI is that it read the invoice correctly">
                {pct(invoice.confidence, 0)} sure
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="tabular shrink-0 text-right text-[22px] font-semibold tracking-tight text-text md:text-[28px]">{money(invoice.total)}</div>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start lg:gap-10">
        <div className="lg:sticky lg:top-24">
          <button
            type="button"
            onClick={() => setShowPaper((v) => !v)}
            aria-expanded={showPaper}
            className="flex h-11 w-full items-center justify-between border-y border-border text-[15px] font-medium text-text lg:hidden"
          >
            {showPaper ? "Hide the original" : "See the original"}
            <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", showPaper && "rotate-180")} />
          </button>
          <div className={cn("mt-3 lg:mt-0 lg:block", showPaper ? "block" : "hidden")}>
            <InvoicePaper invoice={invoice} vendor={vendor} />
          </div>
        </div>

        <div className="min-w-0">
          <div className="mt-5 grid grid-cols-2 gap-3 lg:mt-0">
            <Field label="Vendor" className="col-span-2 md:col-span-1">
              {editable ? (
                <Select
                  value={invoice.vendorId}
                  onChange={(e) =>
                    actions.updateInvoice(
                      invoice.id,
                      { vendorId: e.target.value as VendorId },
                      `Invoice ${invoice.invoiceNumber} reassigned to ${state.vendors.find((v) => v.id === e.target.value)?.name ?? e.target.value}`,
                    )
                  }
                  aria-label="Vendor"
                >
                  {state.vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <div className="flex h-12 items-center text-[15px] font-medium text-text">{vendor?.name}</div>
              )}
            </Field>
            <Field label="Invoice #">
              <Input value={invoice.invoiceNumber} disabled={!editable} onChange={(e) => actions.updateInvoice(invoice.id, { invoiceNumber: e.target.value })} />
            </Field>
            <Field label="Date">
              <Input type="date" value={invoice.date} disabled={!editable} onChange={(e) => actions.updateInvoice(invoice.id, { date: e.target.value })} />
            </Field>
          </div>
          {invoice.notes ? <p className="mt-3 text-[13px] text-muted">{invoice.notes}</p> : null}

          <Section title={`Items (${summary.merch.length})`} className="mt-8">
            <ul className="divide-y divide-border">
              {invoice.lines.map((line) => (
                <LineRow key={line.lineId} line={line} invoice={invoice} editable={editable} productOptions={productOptions} onMatch={(pid) => setMatch(line, pid)} />
              ))}
            </ul>
            <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 border-t border-border pt-3 text-sm">
              <dt className="text-muted">Items</dt>
              <dd className="tabular text-right text-text">{money(invoice.subtotal)}</dd>
              {invoice.fees > 0 ? (
                <>
                  <dt className="text-muted">Delivery and fuel fees</dt>
                  <dd className="tabular text-right text-text">{money(invoice.fees)}</dd>
                </>
              ) : null}
              {invoice.tax > 0 ? (
                <>
                  <dt className="text-muted">Sales tax</dt>
                  <dd className="tabular text-right text-text">{money(invoice.tax)}</dd>
                </>
              ) : null}
              <dt className="font-medium text-text">Total</dt>
              <dd className="tabular text-right font-semibold text-text">{money(invoice.total)}</dd>
            </dl>
          </Section>

          <div className="mt-8 text-[15px] leading-relaxed text-text-2">
            {editable ? (
              <>
                <p className="font-medium text-text">When you approve</p>
                <ul className="mt-1 space-y-0.5">
                  <li>
                    {summary.merch.length} purchases go into price history. {vendor?.shortName}: {summary.ups} up, {summary.downs} down, {summary.newSkus} new.
                  </li>
                  {summary.lowConf.length > 0 ? (
                    <li className="text-warning">
                      Double-check {summary.lowConf.length} line{summary.lowConf.length === 1 ? "" : "s"} the AI wasn&apos;t sure about.
                    </li>
                  ) : null}
                  {summary.unmatched.length > 0 ? (
                    <li className="text-danger">
                      Match {summary.unmatched.length} new item{summary.unmatched.length === 1 ? "" : "s"} to a product first.
                    </li>
                  ) : null}
                  {badPrices.length > 0 ? (
                    <li className="text-danger">
                      Add the missing price on {badPrices.length} line{badPrices.length === 1 ? "" : "s"} first.
                    </li>
                  ) : null}
                </ul>
              </>
            ) : invoice.status === "approved" ? (
              <p>Approved {invoice.approvedAt ? fmtDate(invoice.approvedAt) : ""}. Its prices are in Items.</p>
            ) : (
              <p>Rejected{invoice.rejectReason ? `: ${invoice.rejectReason}` : ""}. Nothing from this invoice was saved.</p>
            )}
          </div>
        </div>
      </div>

      {editable ? (
        <>
          <div className="no-print fixed inset-x-0 bottom-[var(--tabbar-h)] z-10 border-t border-border bg-bg">
            <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-2.5 px-4 md:px-8 md:justify-end">
              <Button variant="outline" onClick={reject} className="flex-1 md:flex-none">
                Reject
              </Button>
              <Button variant="success" icon={<Check className="h-4 w-4" />} onClick={approve} disabled={!canApprove} className="flex-[2] md:flex-none">
                Approve
              </Button>
            </div>
          </div>
          <div className="h-16" aria-hidden />
        </>
      ) : null}

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

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-1.5 text-[13px] font-medium text-muted">{label}</div>
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status: InvoiceRecord["status"] }) {
  switch (status) {
    case "processing":
      return <Badge>Reading…</Badge>;
    case "needs-review":
      return <Badge tone="warning">Needs checking</Badge>;
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
      <li className="flex items-start justify-between gap-4 py-3 text-[15px] text-muted">
        <div className="min-w-0">
          <div>{line.description}</div>
          {line.flags.map((f) => (
            <div key={f} className="text-[13px] text-warning">
              {f}
            </div>
          ))}
        </div>
        <span className="tabular shrink-0">{money(line.total)}</span>
      </li>
    );
  }

  return (
    <li className="py-3.5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[15px] font-medium leading-snug text-text">{line.description}</div>
          <div className="mt-0.5 text-[13px] text-muted">
            {line.sku} · {line.packSize}
          </div>
        </div>
        <div className="tabular shrink-0 text-[15px] font-medium text-text">{money(line.total)}</div>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-3">
        <Badge tone={low ? "warning" : "neutral"} title="How sure the AI is about this line">
          {pct(line.confidence, 0)} sure
        </Badge>
        {line.previousPrice !== undefined && Math.abs(delta) > 0.005 ? (
          <Badge tone={delta > 0 ? "danger" : "success"} title={`Was ${money(line.previousPrice)}`}>
            {signedPct(delta)}
          </Badge>
        ) : null}
        {unmatched ? <Badge tone="danger">New item</Badge> : null}
        {low ? <Badge tone="warning">Check qty</Badge> : null}
      </div>

      {editable ? (
        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-[5.5rem_7rem_minmax(0,1fr)]">
          <div>
            <div className="mb-1 text-[13px] text-muted">Qty</div>
            <Input
              type="number"
              inputMode="decimal"
              value={line.qty}
              onChange={(e) => actions.updateInvoiceLine(invoice.id, line.lineId, { qty: Math.max(0, Number(e.target.value) || 0) })}
              className={cn("tabular h-11", low && "border-warning")}
              aria-label={`Quantity of ${line.description}`}
            />
          </div>
          <div>
            <div className="mb-1 text-[13px] text-muted">Price each</div>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={line.unitPrice}
              onChange={(e) => {
                const unitPrice = Math.max(0, Number(e.target.value) || 0);
                const factor =
                  line.normalizationFactor ??
                  (line.unitPrice > 0 && line.normalizedUnitPrice ? line.normalizedUnitPrice / line.unitPrice : 1);
                actions.updateInvoiceLine(invoice.id, line.lineId, {
                  unitPrice,
                  normalizationFactor: factor,
                  normalizedUnitPrice: line.productId ? round2(unitPrice * factor) : undefined,
                });
              }}
              className="tabular h-11"
              aria-label={`Price of ${line.description}`}
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <div className="mb-1 text-[13px] text-muted">Your item</div>
            <Select
              value={line.productId ?? ""}
              onChange={(e) => onMatch(e.target.value)}
              className={cn("h-11 text-sm", unmatched && "border-danger")}
              aria-label={`Your item for ${line.description}`}
            >
              <option value="">Pick an item…</option>
              <option value="__new__">＋ Add as a new item…</option>
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
          </div>
        </div>
      ) : (
        <div className="mt-1 text-[13px] text-muted">
          {fmtNum(line.qty)} × {money(line.unitPrice)} · {product?.name ?? "No item"}
        </div>
      )}
      {product && line.matchStatus === "suggested" ? <div className="mt-1 text-[13px] text-warning">Our best guess, please confirm</div> : null}
    </li>
  );
}
