"use client";

import { Download, Search } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import { List } from "@/components/ui/List";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { fmtDate, fmtTime } from "@/lib/format";
import type { AuditType } from "@/lib/models";
import { useApp } from "@/lib/store";

type Filter = AuditType | "all";

const TYPE_LABEL: Record<AuditType, string> = {
  inventory: "Count",
  order: "Order",
  invoice: "Invoice",
  price: "Price",
  product: "Item",
  system: "System",
};
const TYPES = Object.keys(TYPE_LABEL) as AuditType[];

function csvEscape(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

export function AuditPage() {
  const { state } = useApp();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const entries = useMemo(() => {
    const t = q.trim().toLowerCase();
    return state.audit.filter(
      (e) =>
        (filter === "all" || e.type === filter) &&
        (!t || e.summary.toLowerCase().includes(t) || (e.details ?? "").toLowerCase().includes(t)),
    );
  }, [state.audit, filter, q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: state.audit.length };
    for (const t of TYPES) c[t] = state.audit.filter((e) => e.type === t).length;
    return c;
  }, [state.audit]);

  const exportCsv = () => {
    const rows = [["timestamp", "type", "actor", "summary", "details"].join(",")].concat(
      entries.map((e) => [e.ts, e.type, e.actor, csvEscape(e.summary), csvEscape(e.details ?? "")].join(",")),
    );
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const rows = useMemo(
    () =>
      entries.map((e, i) => {
        const day = fmtDate(e.ts);
        return { entry: e, day, showDay: day !== (i > 0 ? fmtDate(entries[i - 1].ts) : "") };
      }),
    [entries],
  );

  return (
    <>
      <PageHeader
        title="History"
        description="Every change, newest first."
        actions={
          <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />} onClick={exportCsv} disabled={entries.length === 0}>
            CSV
          </Button>
        }
      />
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" strokeWidth={1.75} />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search history"
          enterKeyHint="search"
          className="border-transparent bg-surface-3 pl-10 focus:bg-surface"
          aria-label="Search history"
        />
      </div>
      <Tabs<Filter>
        value={filter}
        onChange={setFilter}
        options={[{ value: "all", label: "All", count: counts.all }, ...TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t], count: counts[t] }))]}
      />
      {entries.length === 0 ? (
        <EmptyState title="Nothing matches" description="Try another filter or clear the search." />
      ) : (
        <List>
          {rows.map(({ entry, day, showDay }) => (
            <Fragment key={entry.id}>
              {showDay ? <li className="pb-2 pt-6 text-[13px] font-semibold text-muted">{day}</li> : null}
              <li className="py-3">
                <div className="text-[15px] leading-snug text-text">{entry.summary}</div>
                {entry.details ? <div className="mt-0.5 text-[13px] leading-snug text-muted">{entry.details}</div> : null}
                <div className="mt-1 text-[13px] text-muted">
                  {fmtTime(entry.ts)} · {TYPE_LABEL[entry.type]}
                  {entry.actor !== TYPE_LABEL[entry.type] ? ` · ${entry.actor}` : ""}
                </div>
              </li>
            </Fragment>
          ))}
        </List>
      )}
    </>
  );
}
