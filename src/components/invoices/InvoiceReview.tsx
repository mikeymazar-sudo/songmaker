"use client";

import { ArrowLeft, Check, ChevronDown, CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ProductFormModal, type ProductFormDefaults } from "@/components/products/ProductForm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Section } from "@/components/ui/List";
import { Modal } from "@/components/ui/Overlay";
import { Panel } from "@/components/ui/Panel";
import { useToast } from "@/components/ui/Toast";
import { CATEGORIES, type VendorId } from "@/data/types";
import { cn, fmtDate, fmtNum, money, round2, unitLabel } from "@/lib/format";
import { auditInvoice, describeValues, valuesOf, type AuditCheck, type CheckStatus, type InvoiceAudit, type LineIssue } from "@/lib/invoiceAudit";
import type { ExtractedLine, InvoiceRecord, LineValues } from "@/lib/models";
import { useActions, useApp } from "@/lib/store";
import { InvoicePhoto } from "./InvoicePhoto";
import { getPreview } from "./previewStore";
import { PROCESSING_MS } from "./ProcessingWatcher";

type ProductOptions = Array<{ category: string; products: Array<{ id: string; name: string }> }>;

const STEPS = ["Reading every line", "Reading it a second time, separately", "Comparing the two reads", "Checking the math against the total"];

/** A read that has not finished after this long was cut off, usually because the app was closed. */
export const READ_GIVE_UP_MS = 4 * 60_000;

export function readWasCutOff(invoice: InvoiceRecord, now = Date.now()): boolean {
  return invoice.status === "processing" && invoice.extraction === "claude" && now - new Date(invoice.uploadedAt ?? 0).getTime() > READ_GIVE_UP_MS;
}

function Reading({ invoice, onBack }: { invoice: InvoiceRecord; onBack: () => void }) {
  const actions = useActions();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = invoice.uploadedAt ? new Date(invoice.uploadedAt).getTime() : Date.now();
    const t = window.setInterval(() => setElapsed(Date.now() - started), 150);
    return () => window.clearInterval(t);
  }, [invoice.uploadedAt]);
  const real = invoice.extraction === "claude";
  const budget = real ? 45000 : PROCESSING_MS;
  const stepIndex = Math.min(STEPS.length - 1, Math.floor((elapsed / budget) * STEPS.length));
  if (real && elapsed > READ_GIVE_UP_MS) {
    return (
      <div className="mx-auto max-w-sm py-10">
        <h1 className="text-[22px] font-semibold tracking-tight text-text">This read was cut off</h1>
        <p className="mt-1 text-[15px] leading-relaxed text-muted">The app was closed before it finished, so nothing was read. Remove it and scan the invoice again.</p>
        <Button
          className="mt-5 w-full"
          onClick={() => {
            actions.rejectInvoice(invoice.id, "The read was cut off before it finished");
            onBack();
          }}
        >
          Remove it
        </Button>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-text">{real ? "Reading your invoice" : "Getting the sample ready"}</h1>
      <p className="mt-1 text-[15px] leading-relaxed text-muted">{real ? "This takes up to a minute. Keep the app open; you can use the other tabs while it reads." : "This takes a few seconds."}</p>
      <ol className="mt-6 space-y-3 text-[15px]">
        {STEPS.map((s, i) => (
          <li key={s} className={cn("flex items-center gap-3", i < stepIndex ? "text-success" : i === stepIndex ? "text-text" : "text-muted")}>
            {i < stepIndex ? (
              <Check className="h-4 w-4 shrink-0" />
            ) : (
              <span className={cn("h-4 w-4 shrink-0 rounded-full border-2", i === stepIndex ? "animate-spin border-text border-t-transparent" : "border-border-strong")} />
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
  const invoice = state.invoices.find((i) => i.id === invoiceId);
  if (!invoice) {
    return (
      <>
        <BackLink onBack={onBack} />
        <p className="py-10 text-center text-[15px] text-muted">That invoice is no longer available.</p>
      </>
    );
  }
  if (invoice.status === "processing") return <Reading invoice={invoice} onBack={onBack} />;
  // Remount when the read finishes, so the lines that need a look are picked once and then stay put.
  return <Review key={`${invoice.id}:${invoice.status}`} invoice={invoice} onBack={onBack} />;
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className="-ml-1 mb-3 flex h-10 items-center gap-1.5 text-[15px] font-medium text-text-2">
      <ArrowLeft className="h-4 w-4" />
      Invoices
    </button>
  );
}

function Review({ invoice, onBack }: { invoice: InvoiceRecord; onBack: () => void }) {
  const { state } = useApp();
  const actions = useActions();
  const { toast } = useToast();
  const vendor = state.vendors.find((v) => v.id === invoice.vendorId);
  const editable = invoice.status === "needs-review";
  const audit = useMemo(() => auditInvoice(state, invoice), [state, invoice]);
  // Lines that needed a look when the screen opened. They stay in that list after they are settled, so nothing jumps while you work.
  const [pinned] = useState(() => new Set(editable ? Object.keys(audit.issues) : []));
  const [creatingFor, setCreatingFor] = useState<ExtractedLine | null>(null);
  const [asking, setAsking] = useState<"approve" | "reject" | null>(null);
  const [showRest, setShowRest] = useState(!editable || pinned.size === 0);
  const [showPhoto, setShowPhoto] = useState(false);
  const hasPhoto = Boolean(getPreview(invoice.id));

  const merch = invoice.lines.filter((l) => !l.isFee);
  const eyes = invoice.lines.filter((l) => pinned.has(l.lineId));
  const rest = merch.filter((l) => !pinned.has(l.lineId));
  const fees = invoice.lines.filter((l) => l.isFee && !pinned.has(l.lineId));
  const feeTotal = round2(invoice.lines.filter((l) => l.isFee).reduce((s, l) => s + l.total, 0));
  const fromPhotoButFake = invoice.extraction === "simulated" && (invoice.source === "camera" || invoice.source === "upload");

  const productOptions: ProductOptions = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        category: c,
        products: state.products.filter((p) => !p.archived && p.category === c).sort((a, b) => a.name.localeCompare(b.name)),
      })).filter((g) => g.products.length > 0),
    [state.products],
  );

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
    // Per case: the billed price is the base-unit price. Otherwise keep the reader's conversion if there is one;
    // if not, start from the billed price and ask the owner to confirm the per-unit figure.
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
    actions.approveInvoice(invoice.id);
    toast({ title: `Invoice ${invoice.invoiceNumber} approved`, description: `${merch.length} item${merch.length === 1 ? "" : "s"} saved to your prices.` });
    onBack();
  };

  const reject = () => {
    actions.rejectInvoice(invoice.id, fromPhotoButFake ? "Practice data, not read from the photo" : undefined);
    toast({ title: `Invoice ${invoice.invoiceNumber} removed`, description: "Nothing from it was saved.", tone: "info" });
    onBack();
  };

  const defaults: ProductFormDefaults | undefined = creatingFor
    ? { name: titleCase(creatingFor.description), category: creatingFor.category, packSize: creatingFor.packSize, baseUnit: "case", preferredVendorId: invoice.vendorId }
    : undefined;

  const lineCard = (line: ExtractedLine, startOpen: boolean) => (
    <LineCard
      key={line.lineId}
      line={line}
      invoice={invoice}
      issues={audit.issues[line.lineId] ?? []}
      editable={editable}
      startOpen={startOpen}
      productOptions={productOptions}
      onMatch={(pid) => setMatch(line, pid)}
    />
  );

  return (
    <div className={cn(hasPhoto ? "lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start lg:gap-10" : "mx-auto max-w-3xl")}>
      {hasPhoto ? (
        <div className="hidden lg:sticky lg:top-24 lg:block">
          <InvoicePhoto invoice={invoice} />
        </div>
      ) : null}

      <div className="min-w-0">
        <BackLink onBack={onBack} />

        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-[28px] font-semibold leading-tight tracking-tight text-text md:text-[32px]">{vendor?.shortName ?? invoice.vendorId}</h1>
            <p className="mt-1 text-[15px] text-muted">
              #{invoice.invoiceNumber} · {fmtDate(invoice.date)}
            </p>
          </div>
          <div className="tabular shrink-0 text-right text-[22px] font-semibold tracking-tight text-text md:text-[28px]">{money(audit.computedTotal)}</div>
        </div>

        {editable ? (
          <AuditPanel audit={audit} notes={invoice.notes} />
        ) : (
          <p className="text-[15px] leading-relaxed text-text-2">
            {invoice.status === "approved"
              ? `Approved${invoice.approvedAt ? ` ${fmtDate(invoice.approvedAt)}` : ""}. Its prices are in Items.`
              : `Rejected${invoice.rejectReason ? `: ${invoice.rejectReason}` : ""}. Nothing from this invoice was saved.`}
          </p>
        )}

        {hasPhoto ? (
          <div className="mt-4 lg:hidden">
            <button
              type="button"
              onClick={() => setShowPhoto((v) => !v)}
              aria-expanded={showPhoto}
              className="flex h-11 w-full items-center justify-between border-y border-border text-[15px] font-medium text-text"
            >
              {showPhoto ? "Hide your photo" : "See your photo"}
              <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", showPhoto && "rotate-180")} />
            </button>
            {showPhoto ? (
              <div className="mt-3">
                <InvoicePhoto invoice={invoice} />
              </div>
            ) : null}
          </div>
        ) : null}

        {eyes.length > 0 ? (
          <Section title={audit.attention > 0 ? `Needs your eyes (${audit.attention} left)` : "Needed your eyes · all done"} className="mt-8">
            <ul className="divide-y divide-border">{eyes.map((l) => lineCard(l, true))}</ul>
          </Section>
        ) : null}

        <Section
          title={editable ? (eyes.length > 0 ? `Checked, nothing to do (${rest.length})` : `Items (${rest.length})`) : `Items (${rest.length})`}
          className="mt-8"
          action={
            editable && eyes.length > 0 ? (
              <button type="button" onClick={() => setShowRest((v) => !v)} aria-expanded={showRest} className="flex items-center gap-1 text-text-2">
                {showRest ? "Hide" : "Show"}
                <ChevronDown className={cn("h-4 w-4 transition-transform", showRest && "rotate-180")} />
              </button>
            ) : undefined
          }
        >
          {showRest ? <ul className="divide-y divide-border">{rest.map((l) => lineCard(l, false))}</ul> : null}
          {fees.length > 0 ? (
            <ul className={cn("divide-y divide-border", showRest && "border-t border-border")}>
              {fees.map((l) => (
                <li key={l.lineId} className="flex items-start justify-between gap-4 py-3 text-[15px] text-text-2">
                  <span className="min-w-0">{l.description}</span>
                  <span className="tabular shrink-0">{money(l.total)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 border-t border-border pt-3 text-sm">
            <dt className="text-muted">Items</dt>
            <dd className="tabular text-right text-text">{money(round2(merch.reduce((s, l) => s + l.total, 0)))}</dd>
            {feeTotal > 0 ? (
              <>
                <dt className="text-muted">Delivery and fuel fees</dt>
                <dd className="tabular text-right text-text">{money(feeTotal)}</dd>
              </>
            ) : null}
            {invoice.tax > 0 ? (
              <>
                <dt className="text-muted">Sales tax</dt>
                <dd className="tabular text-right text-text">{money(invoice.tax)}</dd>
              </>
            ) : null}
            <dt className="font-medium text-text">Total</dt>
            <dd className="tabular text-right font-semibold text-text">{money(audit.computedTotal)}</dd>
          </dl>
        </Section>

        {editable ? (
          <Section title="Invoice details" className="mt-8">
            <div className="grid grid-cols-2 gap-3 pt-3">
              <Field label="Vendor" className="col-span-2">
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
              </Field>
              <Field label="Invoice #">
                <Input value={invoice.invoiceNumber} onChange={(e) => actions.updateInvoice(invoice.id, { invoiceNumber: e.target.value })} aria-label="Invoice number" />
              </Field>
              <Field label="Date">
                <Input type="date" value={invoice.date} onChange={(e) => actions.updateInvoice(invoice.id, { date: e.target.value })} aria-label="Invoice date" />
              </Field>
              <Field label="Sales tax">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={invoice.tax}
                  onChange={(e) => {
                    const tax = Math.max(0, round2(Number(e.target.value) || 0));
                    actions.updateInvoice(invoice.id, { tax, total: round2(audit.computedTotal - invoice.tax + tax) });
                  }}
                  className="tabular"
                  aria-label="Sales tax"
                />
              </Field>
            </div>
          </Section>
        ) : null}
      </div>

      {editable ? (
        <>
          <div className="no-print fixed inset-x-0 bottom-[var(--tabbar-h)] z-10 border-t border-border bg-bg">
            {audit.blocked && !fromPhotoButFake ? <p className="mx-auto w-full max-w-5xl truncate px-4 pt-2 text-[13px] text-text-2 md:px-8 md:text-right">{audit.blocked}</p> : null}
            <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-2.5 px-4 md:justify-end md:px-8">
              <Button variant="outline" onClick={() => setAsking("reject")} className="flex-1 md:flex-none">
                {fromPhotoButFake ? "Remove it" : "Reject"}
              </Button>
              {fromPhotoButFake ? null : (
                <Button
                  variant={audit.overrides.length > 0 ? "outline" : "success"}
                  icon={audit.overrides.length > 0 ? undefined : <Check className="h-4 w-4" />}
                  onClick={() => (audit.overrides.length > 0 ? setAsking("approve") : approve())}
                  disabled={Boolean(audit.blocked)}
                  className="flex-[2] md:flex-none"
                >
                  {audit.overrides.length > 0 ? "Approve anyway" : "Approve"}
                </Button>
              )}
            </div>
          </div>
          <div className={audit.blocked && !fromPhotoButFake ? "h-24" : "h-16"} aria-hidden />
        </>
      ) : null}

      <Modal
        open={asking === "approve"}
        onClose={() => setAsking(null)}
        size="sm"
        title="Approve with these still open?"
        footer={
          <>
            <Button variant="outline" onClick={() => setAsking(null)}>
              Go back
            </Button>
            <Button variant="danger" onClick={approve}>
              Approve anyway
            </Button>
          </>
        }
      >
        <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-text-2">
          {audit.overrides.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
        <p className="mt-3 text-[15px] leading-relaxed text-text-2">Approving saves these prices to your price list. This choice is written to History.</p>
      </Modal>

      <Modal
        open={asking === "reject"}
        onClose={() => setAsking(null)}
        size="sm"
        title={fromPhotoButFake ? "Remove this practice data?" : "Reject this invoice?"}
        footer={
          <>
            <Button variant="outline" onClick={() => setAsking(null)}>
              Keep it
            </Button>
            <Button variant="danger" onClick={reject}>
              {fromPhotoButFake ? "Remove" : "Reject"}
            </Button>
          </>
        }
      >
        <p className="text-[15px] leading-relaxed text-text-2">Nothing from it will be saved to your prices. It moves to the Rejected tab.</p>
      </Modal>

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
    </div>
  );
}

const STATUS_ICON: Record<CheckStatus, typeof CircleCheck> = { pass: CircleCheck, warn: TriangleAlert, fail: CircleX };
const STATUS_TEXT: Record<CheckStatus, string> = { pass: "text-success", warn: "text-warning", fail: "text-danger" };

/** The app's verdict on its own reading, with every check it ran. */
function AuditPanel({ audit, notes }: { audit: InvoiceAudit; notes?: string }) {
  const [open, setOpen] = useState(audit.status === "fail");
  const Icon = STATUS_ICON[audit.status];
  return (
    <Panel tone={audit.status}>
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 h-6 w-6 shrink-0", STATUS_TEXT[audit.status])} />
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-semibold leading-snug text-text">{audit.headline}</h2>
          <p className="mt-0.5 text-[15px] leading-relaxed text-text-2">{audit.summary}</p>
        </div>
      </div>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-2 flex h-10 items-center gap-1.5 text-sm font-medium text-text-2">
        {open ? "Hide the checks" : `See all ${audit.checks.length} checks`}
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <ul className="space-y-2.5 pb-1">
          {audit.checks.map((c) => (
            <CheckRow key={c.id} check={c} />
          ))}
          {notes ? <li className="pt-1 text-[13px] leading-relaxed text-text-2">Reader&apos;s note: {notes}</li> : null}
        </ul>
      ) : null}
    </Panel>
  );
}

function CheckRow({ check }: { check: AuditCheck }) {
  const Icon = STATUS_ICON[check.status];
  return (
    <li className="flex items-start gap-2.5">
      <Icon className={cn("mt-0.5 h-[18px] w-[18px] shrink-0", STATUS_TEXT[check.status])} />
      <div className="min-w-0">
        <div className="text-[15px] leading-snug text-text">{check.title}</div>
        {check.detail ? <div className="mt-0.5 text-[13px] leading-relaxed text-text-2">{check.detail}</div> : null}
      </div>
    </li>
  );
}

function LineCard({
  line,
  invoice,
  issues,
  editable,
  startOpen,
  productOptions,
  onMatch,
}: {
  line: ExtractedLine;
  invoice: InvoiceRecord;
  issues: LineIssue[];
  editable: boolean;
  startOpen: boolean;
  productOptions: ProductOptions;
  onMatch: (productId: string) => void;
}) {
  const actions = useActions();
  const { state } = useApp();
  const [open, setOpen] = useState(startOpen);
  const product = line.productId ? state.products.find((p) => p.id === line.productId) : undefined;
  const check = line.check;
  const hard = issues.some((i) => i.hard);
  const other = check?.status === "unsure" && !check.ok ? check.other : undefined;

  const looksRight = () =>
    actions.updateInvoiceLine(invoice.id, line.lineId, {
      check: { ...check, ok: true },
      matchStatus: line.matchStatus === "suggested" ? "matched" : line.matchStatus,
    });

  const use = (v: LineValues, fromSecondRead: boolean) => {
    const factor = line.normalizationFactor ?? (line.unitPrice > 0 && line.normalizedUnitPrice ? line.normalizedUnitPrice / line.unitPrice : 1);
    actions.updateInvoiceLine(invoice.id, line.lineId, {
      qty: v.qty,
      unitPrice: v.unitPrice,
      normalizationFactor: factor,
      normalizedUnitPrice: line.productId ? round2(v.unitPrice * factor) : undefined,
      check: fromSecondRead ? { status: "corrected", was: valuesOf(line), note: "You picked the second read.", ok: true } : { ...check, ok: true },
    });
  };

  let mark: React.ReactNode = null;
  if (issues.length > 0) mark = <Badge tone={hard ? "danger" : "warning"}>{hard ? "Fix" : "Look"}</Badge>;
  else if (check?.ok) mark = <Badge tone="success">Checked by you</Badge>;
  else if (check?.status === "corrected") mark = <Badge tone="success">Fixed by the math</Badge>;
  else if (check?.status === "confirmed") mark = <Check className="ml-auto h-4 w-4 text-success" aria-label="Both reads agree" />;

  return (
    <li>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-start justify-between gap-4 py-3.5 text-left active:opacity-60">
        <div className="min-w-0">
          <div className="text-[15px] font-medium leading-snug text-text">{line.description}</div>
          <div className="mt-0.5 text-[13px] text-muted">
            {line.isFee ? "Fee" : `${fmtNum(line.qty)} × ${money(line.unitPrice)}`}
            {product ? ` · ${product.name}` : ""}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
          <span className="tabular text-[15px] font-medium text-text">{money(line.total)}</span>
          {mark}
        </div>
      </button>

      {open ? (
        <div className="pb-4">
          {issues.map((i) => (
            <p key={i.text} className={cn("flex items-start gap-2 pb-2 text-[15px] leading-snug", i.hard ? "text-danger" : "text-warning")}>
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {i.text}
            </p>
          ))}
          {check?.note && (issues.length === 0 || check.status === "corrected") ? <p className="pb-2 text-[13px] leading-relaxed text-text-2">{check.note}</p> : null}
          {check?.was ? <p className="pb-2 text-[13px] text-text-2">The first read said {describeValues(check.was)}.</p> : null}

          {editable && other ? <p className="pb-2 text-[13px] text-text-2">Tap the one that matches the paper, or type the right numbers below.</p> : null}
          {editable && other ? (
            <div className="grid gap-2 pb-3 sm:grid-cols-2">
              <Choice label="First read" values={valuesOf(line)} onClick={() => use(valuesOf(line), false)} />
              <Choice label="Second read" values={other} onClick={() => use(other, true)} />
            </div>
          ) : null}

          {editable ? (
            <>
              <div className={cn("grid grid-cols-2 gap-2", !line.isFee && "sm:grid-cols-[5.5rem_7rem_minmax(0,1fr)]")}>
                {line.isFee ? null : (
                  <Field label="Qty">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={line.qty}
                      onChange={(e) => actions.updateInvoiceLine(invoice.id, line.lineId, { qty: Math.max(0, Number(e.target.value) || 0) })}
                      className="tabular h-11"
                      aria-label={`Quantity of ${line.description}`}
                    />
                  </Field>
                )}
                <Field label={line.isFee ? "Amount" : "Price each"}>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(e) => {
                      const unitPrice = Math.max(0, Number(e.target.value) || 0);
                      const factor = line.normalizationFactor ?? (line.unitPrice > 0 && line.normalizedUnitPrice ? line.normalizedUnitPrice / line.unitPrice : 1);
                      actions.updateInvoiceLine(invoice.id, line.lineId, {
                        unitPrice,
                        normalizationFactor: factor,
                        normalizedUnitPrice: line.productId ? round2(unitPrice * factor) : undefined,
                      });
                    }}
                    className="tabular h-11"
                    aria-label={`Price of ${line.description}`}
                  />
                </Field>
                {line.isFee ? null : (
                  <Field label="Your item" className="col-span-2 sm:col-span-1">
                    <Select
                      value={line.productId ?? ""}
                      onChange={(e) => onMatch(e.target.value)}
                      className={cn("h-11 text-sm", !line.productId && "border-danger")}
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
                  </Field>
                )}
              </div>
              {product && product.baseUnit !== "case" ? (
                <Field label={`Price per ${unitLabel(product.baseUnit)}. ${product.name} is compared per ${unitLabel(product.baseUnit)}, so this is the price that gets saved.`} className="mt-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={line.normalizedUnitPrice ?? ""}
                    onChange={(e) => {
                      const perUnit = Math.max(0, Number(e.target.value) || 0);
                      actions.updateInvoiceLine(invoice.id, line.lineId, {
                        normalizedUnitPrice: perUnit,
                        normalizationFactor: line.unitPrice > 0 ? perUnit / line.unitPrice : undefined,
                      });
                    }}
                    className="tabular h-11 sm:w-40"
                    aria-label={`Price per ${unitLabel(product.baseUnit)} of ${line.description}`}
                  />
                </Field>
              ) : null}
              <div className="mt-3 flex items-center justify-between gap-3">
                {issues.length > 0 && !hard ? (
                  <Button size="sm" variant="secondary" icon={<Check className="h-4 w-4" />} onClick={looksRight}>
                    Looks right
                  </Button>
                ) : (
                  <span />
                )}
                <button type="button" onClick={() => actions.removeInvoiceLine(invoice.id, line.lineId)} className="h-10 px-1 text-sm font-medium text-muted underline-offset-2 active:opacity-60 md:hover:underline">
                  Remove line
                </button>
              </div>
            </>
          ) : (
            <p className="text-[13px] text-muted">
              {line.sku ? `#${line.sku} · ` : ""}
              {line.packSize}
            </p>
          )}
        </div>
      ) : null}
    </li>
  );
}

/** One of the two reads of a line, as a button. */
function Choice({ label, values, onClick }: { label: string; values: LineValues; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-xl border border-border-strong bg-surface px-3.5 py-2.5 text-left transition-colors active:bg-surface-3 md:hover:bg-surface-2">
      <span className="block text-[13px] text-muted">{label}</span>
      <span className="tabular block text-[15px] font-medium text-text">{describeValues(values)}</span>
    </button>
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
      <div className="mb-1 text-[13px] text-muted">{label}</div>
      {children}
    </div>
  );
}
