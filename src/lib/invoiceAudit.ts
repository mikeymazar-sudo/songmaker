import { fmtDate, fmtNum, money, round2, todayISO, daysAgoISO } from "./format";
import type { AppState, ExtractedLine, InvoiceRecord, LineValues, SecondReadSummary } from "./models";
import { percentFeeRate } from "./pricing";

/*
 * The app checks its own reading of an invoice in two ways:
 *   1. reconcileReads: the photo is read twice, separately. Code compares the two reads number by number.
 *      Where they disagree, arithmetic decides if it can (does quantity x price equal the line total, does
 *      the invoice add up to the total on the paper). What arithmetic cannot settle goes to the owner.
 *   2. auditInvoice: a list of checks, recomputed every time the invoice changes, that says whether the
 *      invoice is safe to approve and which lines need a look.
 */

// ---------- comparing numbers ----------

const CENT = 0.011;
/** Totals on a long invoice can drift a few cents from rounding each line. */
const TOTAL_SLACK = 0.05;
const BIG_PRICE_MOVE = 0.2;
const LOW_CONFIDENCE = 0.7;
const MAX_UNSETTLED = 12;

const nearMoney = (a: number, b: number) => Math.abs(a - b) <= CENT;
const nearQty = (a: number, b: number) => Math.abs(a - b) <= 0.001;

export function valuesOf(line: LineValues): LineValues {
  return { qty: line.qty, unitPrice: line.unitPrice, total: line.total };
}

function sameValues(a: LineValues, b: LineValues): boolean {
  return nearQty(a.qty, b.qty) && nearMoney(a.unitPrice, b.unitPrice) && nearMoney(a.total, b.total);
}

/** Quantity x price equals the line total, allowing half a cent of rounding per unit. */
export function lineAddsUp(v: LineValues): boolean {
  return Math.abs(round2(v.qty * v.unitPrice) - v.total) <= Math.max(0.02, Math.abs(v.qty) * 0.005);
}

export function describeValues(v: LineValues): string {
  return `${fmtNum(v.qty)} × ${money(v.unitPrice)} = ${money(v.total)}`;
}

// ---------- the second read ----------

export interface SecondReadLine {
  sku: string;
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
  isFee: boolean;
  unclear: boolean;
}

export interface SecondRead {
  invoiceNumber: string;
  date: string;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  lines: SecondReadLine[];
  legibility: "good" | "fair" | "poor";
  notes: string;
}

const skuKey = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
const wordsOf = (s: string) => new Set(s.toUpperCase().split(/[^A-Z0-9]+/).filter((t) => t.length > 1));

function wordOverlap(a: string, b: string): number {
  const A = wordsOf(a);
  const B = wordsOf(b);
  if (A.size === 0 || B.size === 0) return 0;
  let hits = 0;
  for (const t of A) if (B.has(t)) hits += 1;
  return hits / Math.min(A.size, B.size);
}

/** Pairs each line of the first read with the same line in the second: item number first, then wording and amount, then order. */
function pairLines(first: ExtractedLine[], second: SecondReadLine[]): Map<number, number> {
  const pairs = new Map<number, number>();
  const used = new Set<number>();
  const open = () => first.map((_, i) => i).filter((i) => !first[i].derived && !pairs.has(i));

  for (const i of open()) {
    const key = skuKey(first[i].sku);
    if (key.length < 3 || key === "FEE") continue;
    const j = second.findIndex((s, idx) => !used.has(idx) && skuKey(s.sku) === key && s.isFee === Boolean(first[i].isFee));
    if (j >= 0) {
      pairs.set(i, j);
      used.add(j);
    }
  }

  for (const i of open()) {
    let best = -1;
    let bestScore = 0;
    second.forEach((s, j) => {
      if (used.has(j) || s.isFee !== Boolean(first[i].isFee)) return;
      const score = wordOverlap(first[i].description, s.description) + (nearMoney(first[i].total, s.total) ? 0.5 : 0);
      if (score > bestScore) {
        best = j;
        bestScore = score;
      }
    });
    if (best >= 0 && bestScore >= 0.6) {
      pairs.set(i, best);
      used.add(best);
    }
  }

  // Whatever is left pairs up in document order, but only when both reads have the same number left over.
  const leftFirst = open();
  const leftSecond = second.map((_, j) => j).filter((j) => !used.has(j));
  if (leftFirst.length > 0 && leftFirst.length === leftSecond.length) {
    leftFirst.forEach((i, n) => pairs.set(i, leftSecond[n]));
  }
  return pairs;
}

interface Unsettled {
  /** Index in the first read, or -1 for a line only the second read found. */
  i: number;
  /** Index in the second read, or -1 for a line only the first read found. */
  j: number;
  firstTotal: number;
  secondTotal: number;
}

/**
 * Tries every way of choosing between the two reads for the lines they disagree on, and keeps the choices
 * that make the invoice add up to the total on the paper. A choice is settled only when every combination
 * that adds up agrees on it.
 */
function settleByTotal(items: Unsettled[], fixedSum: number, target: number): Map<Unsettled, "first" | "second"> {
  const settled = new Map<Unsettled, "first" | "second">();
  if (items.length === 0 || items.length > MAX_UNSETTLED) return settled;
  const winners: number[] = [];
  for (let mask = 0; mask < 1 << items.length; mask += 1) {
    let sum = fixedSum;
    items.forEach((item, n) => {
      sum += mask & (1 << n) ? item.secondTotal : item.firstTotal;
    });
    if (Math.abs(sum - target) <= TOTAL_SLACK) winners.push(mask);
  }
  if (winners.length === 0) return settled;
  items.forEach((item, n) => {
    if (nearMoney(item.firstTotal, item.secondTotal)) return; // The total cannot tell these two apart.
    const picks = new Set(winners.map((mask) => Boolean(mask & (1 << n))));
    if (picks.size === 1) settled.set(item, picks.has(true) ? "second" : "first");
  });
  return settled;
}

export interface Reconciled {
  lines: ExtractedLine[];
  secondRead: SecondReadSummary;
}

/** Compares the two reads and returns the first read's lines with a verdict on each. */
export function reconcileReads(
  invoiceId: string,
  firstLines: ExtractedLine[],
  first: { tax: number; printedTotal?: number },
  second: SecondRead,
  at: string,
): Reconciled {
  const lines = firstLines.map((l) => ({ ...l }));
  const pairs = pairLines(lines, second.lines);
  const unsettled: Unsettled[] = [];

  lines.forEach((line, i) => {
    if (line.derived) return;
    const j = pairs.get(i);
    if (j === undefined) {
      line.check = { status: "unsure", note: "The second read did not find this line on the invoice." };
      unsettled.push({ i, j: -1, firstTotal: line.total, secondTotal: 0 });
      return;
    }
    const a = valuesOf(line);
    const b = valuesOf(second.lines[j]);
    if (sameValues(a, b)) {
      line.check = { status: "confirmed" };
      return;
    }
    const aOk = lineAddsUp(a);
    const bOk = lineAddsUp(b);
    if (aOk && !bOk) {
      line.check = { status: "confirmed", note: "The second read was unclear here. Quantity × price backs the first read." };
    } else if (!aOk && bOk) {
      Object.assign(line, b);
      line.check = { status: "corrected", was: a, note: "The first read did not add up. The second read does." };
    } else {
      line.check = { status: "unsure", other: b, note: "The two reads saw different numbers." };
      unsettled.push({ i, j, firstTotal: a.total, secondTotal: b.total });
    }
  });

  const pairedSecond = new Set(pairs.values());
  second.lines.forEach((s, j) => {
    if (!pairedSecond.has(j)) unsettled.push({ i: -1, j, firstTotal: 0, secondTotal: s.total });
  });

  // The total on the paper can settle what is left, as long as both reads agree on what that total is.
  const taxAgrees = second.tax === null || nearMoney(second.tax, first.tax);
  const totalsSeen = [first.printedTotal, second.total ?? undefined].filter((t): t is number => t !== undefined && t > 0);
  const target = totalsSeen.length > 0 && totalsSeen.every((t) => Math.abs(t - totalsSeen[0]) <= TOTAL_SLACK) ? totalsSeen[0] : undefined;
  const hasDerivedFee = lines.some((l) => l.derived);
  let settled = new Map<Unsettled, "first" | "second">();
  if (target !== undefined && taxAgrees && !hasDerivedFee) {
    const open = new Set(unsettled.filter((u) => u.i >= 0).map((u) => u.i));
    const fixedSum = lines.reduce((s, l, i) => (open.has(i) ? s : s + l.total), 0) + first.tax;
    settled = settleByTotal(unsettled, fixedSum, target);
  }

  const added: ExtractedLine[] = [];
  const dropped: string[] = [];
  for (const item of unsettled) {
    const pick = settled.get(item);
    if (item.i >= 0 && item.j >= 0) {
      const line = lines[item.i];
      const other = line.check?.other;
      if (pick === "second" && other) {
        const was = valuesOf(line);
        Object.assign(line, other);
        line.check = { status: "corrected", was, note: "The two reads differed. Only the second read adds up to the invoice total." };
      } else if (pick === "first") {
        line.check = { status: "confirmed", note: "The two reads differed. Only the first read adds up to the invoice total." };
      }
    } else if (item.i >= 0) {
      const line = lines[item.i];
      if (pick === "first") {
        line.check = { status: "confirmed", note: "The second read missed this line. The invoice total confirms it belongs." };
      } else if (pick === "second") {
        line.check = { status: "unsure", note: "The second read did not find this line, and the invoice total does not include it. Remove it if it is not on the paper." };
      }
    } else {
      const s = second.lines[item.j];
      if (pick === "first") {
        dropped.push(s.description);
        continue;
      }
      added.push({
        lineId: `${invoiceId}-x${added.length + 1}`,
        sku: s.sku,
        description: s.description,
        packSize: "",
        qty: round2(s.qty),
        unitPrice: round2(s.unitPrice),
        total: round2(s.total),
        isFee: s.isFee,
        confidence: 0.5,
        matchStatus: s.isFee ? "matched" : "unmatched",
        flags: ["Found on the second read only"],
        check:
          pick === "second"
            ? { status: "corrected", note: "The first read missed this line. The invoice total confirms it belongs." }
            : { status: "unsure", note: "Only the second read found this line. Remove it if it is not on the paper." },
      });
    }
  }

  const all = [...lines.filter((l) => !l.isFee), ...added.filter((l) => !l.isFee), ...lines.filter((l) => l.isFee), ...added.filter((l) => l.isFee)];
  const judged = all.filter((l) => !l.derived);
  const notes = [second.notes.trim(), dropped.length > 0 ? `Left out, because the invoice total does not include it: ${dropped.join("; ")}.` : ""].filter(Boolean).join(" ");

  return {
    lines: all,
    secondRead: {
      at,
      legibility: second.legibility,
      invoiceNumber: second.invoiceNumber.trim() || undefined,
      date: second.date || undefined,
      total: second.total ?? undefined,
      tax: second.tax ?? undefined,
      lines: second.lines.length,
      confirmed: judged.filter((l) => l.check?.status === "confirmed").length,
      corrected: judged.filter((l) => l.check?.status === "corrected").length - added.filter((l) => l.check?.status === "corrected").length,
      unsure: judged.filter((l) => l.check?.status === "unsure").length,
      added: added.length,
      notes: notes || undefined,
    },
  };
}

// ---------- the audit ----------

export type CheckStatus = "pass" | "warn" | "fail";

export interface AuditCheck {
  id: string;
  status: CheckStatus;
  title: string;
  detail?: string;
}

export interface LineIssue {
  /** Hard issues must be fixed before approving. Soft ones go away when the owner says the line is right. */
  hard: boolean;
  text: string;
}

export interface InvoiceAudit {
  status: CheckStatus;
  headline: string;
  summary: string;
  checks: AuditCheck[];
  /** Open issues by line. A line with no entry needs nothing from the owner. */
  issues: Record<string, LineIssue[]>;
  /** Lines the owner still has to look at. */
  attention: number;
  /** Why this invoice cannot be approved at all, if it cannot. */
  blocked: string | null;
  /** Problems that do not stop approval but have to be accepted out loud. */
  overrides: string[];
  /** Lines + fees + tax, from the lines as they stand now. */
  computedTotal: number;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function auditInvoice(state: AppState, invoice: InvoiceRecord): InvoiceAudit {
  const vendor = state.vendors.find((v) => v.id === invoice.vendorId);
  const merch = invoice.lines.filter((l) => !l.isFee);
  const second = invoice.verification?.secondRead;
  const issues: Record<string, LineIssue[]> = {};
  const flag = (line: ExtractedLine, hard: boolean, text: string) => {
    (issues[line.lineId] ??= []).push({ hard, text });
  };
  const checks: AuditCheck[] = [];
  const overrides: string[] = [];
  let blocked: string | null = null;

  // Where the numbers came from.
  const fromPhoto = invoice.source === "camera" || invoice.source === "upload";
  if (invoice.extraction === "simulated" && fromPhoto) {
    blocked = "This is made-up practice data. Nothing was read from your photo.";
    checks.push({ id: "source", status: "fail", title: "Not read from your photo", detail: "Photo reading was off when this was added, so the app filled in sample numbers. Remove it and scan the invoice again once reading is on." });
  } else if (invoice.extraction === "simulated") {
    overrides.push("This is a practice sample, not a real delivery.");
    checks.push({ id: "source", status: "warn", title: "Practice sample", detail: "Approving writes these sample prices into your real price list." });
  } else if (invoice.extraction === "claude") {
    if (second) {
      const open = invoice.lines.filter((l) => l.check?.status === "unsure" && !l.check.ok).length;
      const fixed = invoice.lines.filter((l) => l.check?.status === "corrected").length;
      const settled = invoice.lines.filter((l) => l.check?.status === "confirmed" && l.check.note).length;
      const judged = invoice.lines.filter((l) => !l.derived).length;
      const parts = [`The two reads matched outright on ${judged - open - fixed - settled} of ${plural(judged, "line")}.`];
      if (fixed + settled > 0) parts.push(`${plural(fixed + settled, "difference")} settled by the math${fixed > 0 ? `, ${fixed} of them changing the first read` : ""}.`);
      if (open > 0) parts.push(`${plural(open, "line")} could not be settled and ${open === 1 ? "is" : "are"} waiting for you.`);
      checks.push({ id: "second-read", status: open > 0 ? "warn" : "pass", title: open > 0 ? `The two reads disagree on ${plural(open, "line")}` : "Read twice, and the two reads agree", detail: parts.join(" ") });
      if (second.legibility === "poor") {
        checks.push({ id: "photo", status: "warn", title: "The photo was hard to read", detail: "Retake it in better light if anything below looks wrong." });
      }
      const headerDiffs: string[] = [];
      if (second.invoiceNumber && skuKey(second.invoiceNumber) !== skuKey(invoice.invoiceNumber)) headerDiffs.push(`invoice number (${invoice.invoiceNumber} or ${second.invoiceNumber})`);
      if (second.date && second.date !== invoice.date) headerDiffs.push(`date (${fmtDate(invoice.date)} or ${fmtDate(second.date)})`);
      if (second.tax !== undefined && !nearMoney(second.tax, invoice.tax)) headerDiffs.push(`tax (${money(invoice.tax)} or ${money(second.tax)})`);
      if (headerDiffs.length > 0) {
        checks.push({ id: "header", status: "warn", title: "The two reads differ at the top of the invoice", detail: `Check the ${headerDiffs.join(", ")}.` });
      }
    } else {
      overrides.push("This invoice was only read once.");
      checks.push({ id: "second-read", status: "warn", title: "Only read once", detail: invoice.verification?.secondReadError ? `The second read did not finish: ${invoice.verification.secondReadError}` : "The second read did not run, so the numbers were not double-checked." });
    }
  }

  // Line by line.
  const seen = new Set<string>();
  let mathOff = 0;
  let unmatched = 0;
  let guesses = 0;
  let missingPrice = 0;
  let bigMoves = 0;
  for (const line of invoice.lines) {
    const ok = Boolean(line.check?.ok);
    if (line.isFee) {
      if (line.derived && !ok) flag(line, false, "This fee is not printed on the paper. It was worked out from the handwritten total.");
      if (line.check?.status === "unsure" && !ok) flag(line, false, line.check.note ?? "The two reads saw different numbers.");
      continue;
    }
    if (line.matchStatus === "unmatched" || !line.productId) {
      unmatched += 1;
      flag(line, true, "New item. Pick which of your items this is.");
    } else if (line.matchStatus === "suggested") {
      guesses += 1;
      flag(line, false, "Best-guess match. Confirm it is the right item.");
    }
    if (!(line.unitPrice > 0) || (line.productId && !((line.normalizedUnitPrice ?? line.unitPrice) > 0))) {
      missingPrice += 1;
      flag(line, true, "Missing price.");
    }
    if (line.check?.status === "unsure" && !ok) flag(line, false, line.check.note ?? "The two reads saw different numbers.");
    if (!lineAddsUp(line) && !ok) {
      mathOff += 1;
      flag(line, false, `Quantity × price is ${money(round2(line.qty * line.unitPrice))}, but the line total says ${money(line.total)}.`);
    }
    if (line.previousPrice && line.normalizedUnitPrice && !ok) {
      const move = (line.normalizedUnitPrice - line.previousPrice) / line.previousPrice;
      if (Math.abs(move) > BIG_PRICE_MOVE) {
        bigMoves += 1;
        flag(line, false, `Price is ${move > 0 ? "up" : "down"} ${Math.abs(move * 100).toFixed(0)}% from last time (${money(line.previousPrice)} to ${money(line.normalizedUnitPrice)}). A jump this big is often a misread.`);
      }
    }
    if (!second && line.confidence < LOW_CONFIDENCE && !ok) flag(line, false, "Hard to read. Check it against the paper.");
    const key = `${skuKey(line.sku) || line.description.toUpperCase()}|${line.qty}|${line.unitPrice}`;
    if (seen.has(key) && !ok) flag(line, false, "The same item and amount appears twice. Make sure it was billed twice.");
    seen.add(key);
  }

  if (invoice.extraction !== "simulated" || !fromPhoto) {
    checks.push(
      mathOff > 0
        ? { id: "lines", status: "warn", title: `${plural(mathOff, "line")} where quantity × price is not the line total` }
        : { id: "lines", status: "pass", title: "Every line: quantity × price equals the line total" },
    );
  }

  // Does the invoice add up to the total on the paper?
  const subtotal = round2(merch.reduce((s, l) => s + l.total, 0));
  const fees = round2(invoice.lines.filter((l) => l.isFee).reduce((s, l) => s + l.total, 0));
  const computedTotal = round2(subtotal + fees + invoice.tax);
  const printedFirst = invoice.verification?.printedTotal;
  const printedSecond = second?.total;
  if (invoice.extraction === "claude") {
    if (printedFirst !== undefined && printedSecond !== undefined && Math.abs(printedFirst - printedSecond) > TOTAL_SLACK) {
      overrides.push("The two reads saw different invoice totals.");
      checks.push({ id: "total", status: "fail", title: "The two reads saw different invoice totals", detail: `${money(printedFirst)} and ${money(printedSecond)}. Check the total on the paper.` });
    } else {
      const printed = printedSecond ?? printedFirst;
      if (printed === undefined) {
        checks.push({ id: "total", status: "warn", title: "No total found on the paper to check against", detail: `Lines, fees and tax come to ${money(computedTotal)}.` });
      } else if (Math.abs(computedTotal - printed) <= TOTAL_SLACK) {
        checks.push({ id: "total", status: "pass", title: `Adds up to the total on the paper, ${money(printed)}`, detail: `Items ${money(subtotal)}${fees > 0 ? ` + fees ${money(fees)}` : ""}${invoice.tax > 0 ? ` + tax ${money(invoice.tax)}` : ""}.` });
      } else {
        overrides.push(`The lines come to ${money(computedTotal)}, but the paper says ${money(printed)}.`);
        checks.push({ id: "total", status: "fail", title: `Does not add up: off by ${money(Math.abs(computedTotal - printed))}`, detail: `Lines, fees and tax come to ${money(computedTotal)}. The paper says ${money(printed)}. A line is misread or missing.` });
      }
    }
  }

  // A fee that is not printed: does it look like this vendor's usual fee?
  const derived = invoice.lines.filter((l) => l.derived);
  if (derived.length > 0 && vendor) {
    const amount = round2(derived.reduce((s, l) => s + l.total, 0));
    const expected = round2(merch.reduce((s, l) => s + l.total * percentFeeRate(vendor, l.category ?? "Dry Goods / Pantry / Oils"), 0));
    const close = expected > 0 && Math.abs(amount - expected) <= Math.max(0.5, expected * 0.03);
    checks.push(
      close
        ? { id: "fee", status: "pass", title: `Unprinted fee of ${money(amount)} matches ${vendor.shortName}'s usual fee` }
        : { id: "fee", status: "warn", title: `Unprinted fee of ${money(amount)} looks unusual`, detail: expected > 0 ? `${vendor.shortName}'s usual fee on these items would be about ${money(expected)}. A line may be misread.` : `${vendor.shortName} does not usually add a fee like this.` },
    );
  }

  if (unmatched > 0) blocked ??= `Match ${plural(unmatched, "new item")} to your items first.`;
  if (missingPrice > 0) blocked ??= `Add the missing price on ${plural(missingPrice, "line")} first.`;
  checks.push(
    unmatched > 0
      ? { id: "items", status: "warn", title: `${plural(unmatched, "new item")} to match to your items` }
      : guesses > 0
        ? { id: "items", status: "warn", title: `${plural(guesses, "best-guess match", "best-guess matches")} to confirm` }
        : { id: "items", status: "pass", title: "Every line is matched to one of your items" },
  );
  if (missingPrice > 0) checks.push({ id: "prices", status: "fail", title: `${plural(missingPrice, "line")} with no price` });
  else if (bigMoves > 0) checks.push({ id: "prices", status: "warn", title: `${plural(bigMoves, "price")} moved more than 20% since last time` });
  else if (merch.some((l) => l.previousPrice)) checks.push({ id: "prices", status: "pass", title: "Prices are in line with your last invoices" });

  // Already here?
  const number = skuKey(invoice.invoiceNumber);
  const twin = number.length > 1 ? state.invoices.find((i) => i.id !== invoice.id && i.vendorId === invoice.vendorId && i.status !== "rejected" && skuKey(i.invoiceNumber) === number) : undefined;
  if (twin) {
    overrides.push(`Invoice #${invoice.invoiceNumber} from ${vendor?.shortName ?? invoice.vendorId} is already in the app.`);
    checks.push({ id: "duplicate", status: "fail", title: "This invoice is already in the app", detail: `#${twin.invoiceNumber} from ${vendor?.name ?? twin.vendorId}, ${twin.status === "approved" ? "approved" : "waiting to be checked"}. Approving both counts the delivery twice.` });
  } else {
    checks.push({ id: "duplicate", status: "pass", title: "Not a repeat of an invoice already in the app" });
  }

  if (invoice.date > todayISO()) checks.push({ id: "date", status: "warn", title: `Dated in the future: ${fmtDate(invoice.date)}` });
  else if (invoice.date < daysAgoISO(60)) checks.push({ id: "date", status: "warn", title: `Dated ${fmtDate(invoice.date)}, more than two months ago` });

  const attention = Object.keys(issues).length;
  const unlooked = Object.values(issues).filter((list) => list.every((i) => !i.hard)).length;
  if (unlooked > 0) overrides.push(`${plural(unlooked, "flagged line")} ${unlooked === 1 ? "has" : "have"} not been looked at.`);
  const fails = checks.filter((c) => c.status === "fail");
  const status: CheckStatus = fails.length > 0 ? "fail" : attention > 0 || blocked || checks.some((c) => c.status === "warn") ? "warn" : "pass";

  let headline: string;
  if (invoice.extraction === "simulated" && fromPhoto) headline = "Not your invoice";
  else if (status === "fail") headline = fails[0].title;
  else if (attention > 0) headline = `${plural(attention, "line")} need${attention === 1 ? "s" : ""} your eyes`;
  else if (status === "warn") headline = checks.find((c) => c.status === "warn")?.title ?? "One thing to know";
  else headline = "Checked. Everything matches.";

  const facts: string[] = [];
  if (second) facts.push("Read twice");
  else if (invoice.extraction === "claude") facts.push("Read once");
  facts.push(plural(merch.length, "item"));
  const totalCheck = checks.find((c) => c.id === "total");
  if (totalCheck?.status === "pass") facts.push(`adds up to ${money(computedTotal)}`);
  const summary = `${facts.join(" · ")}.`;

  // Problems first, so the reason for the verdict is the first thing in the list.
  const rank: Record<CheckStatus, number> = { fail: 0, warn: 1, pass: 2 };
  checks.sort((a, b) => rank[a.status] - rank[b.status]);

  return { status, headline, summary, checks, issues, attention, blocked, overrides, computedTotal };
}

/** One line for the history log, written when an invoice is approved. */
export function summarizeAudit(audit: InvoiceAudit): string {
  const passed = audit.checks.filter((c) => c.status === "pass").length;
  const open = audit.checks.filter((c) => c.status !== "pass").map((c) => c.title);
  return `Self-check: ${passed} of ${audit.checks.length} checks passed.${open.length > 0 ? ` Approved with these still open: ${open.join("; ")}.` : ""}`;
}
