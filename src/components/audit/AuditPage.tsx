"use client";

import { Download, History, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { fmtDate, fmtTime } from "@/lib/format";
import type { AuditEntry, AuditType } from "@/lib/models";
import { useApp } from "@/lib/store";
import { AuditTypeBadge, auditTypeLabel } from "./AuditTypeBadge";

type Filter = AuditType | "all";
const TYPES: AuditType[] = ["inventory", "order", "invoice", "price", "product", "system"];

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

  const rowsWithDay = useMemo(
    () =>
      entries.map((e, i) => {
        const day = fmtDate(e.ts);
        const prevDay = i > 0 ? fmtDate(entries[i - 1].ts) : "";
        return { entry: e, day, showDay: day !== prevDay };
      }),
    [entries],
  );

  return (
    <>
      <PageHeader
        title="History"
        description="Every count, correction, approval and price change, newest first. If something changed, it's written down here."
        actions={
          <Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={exportCsv} disabled={entries.length === 0}>
            Download (CSV)
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SegmentedControl<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: counts.all },
            ...TYPES.map((t) => ({ value: t, label: auditTypeLabel(t), count: counts[t] })),
          ]}
        />
        <div className="relative w-full md:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search history" className="pl-10" aria-label="Search history" />
        </div>
      </div>
      {entries.length === 0 ? (
        <EmptyState icon={<History className="h-6 w-6" />} title="Nothing matches" description="Try another filter or clear the search." />
      ) : (
        <Card className="overflow-hidden">
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>Time</Th>
                  <Th>Type</Th>
                  <Th>What happened</Th>
                  <Th>Who</Th>
                </tr>
              </thead>
              <tbody>
                {rowsWithDay.map(({ entry, day, showDay }) => (
                  <AuditRow key={entry.id} entry={entry} showDay={showDay} day={day} />
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      )}
    </>
  );
}

function AuditRow({ entry, showDay, day }: { entry: AuditEntry; showDay: boolean; day: string }) {
  return (
    <>
      {showDay ? (
        <tr>
          <td colSpan={4} className="border-b border-border bg-surface-2 px-5 pb-2 pt-4 text-[15px] font-semibold text-text">
            {day}
          </td>
        </tr>
      ) : null}
      <tr className="hover:bg-surface-2/60">
        <Td className="tabular whitespace-nowrap text-muted">{fmtTime(entry.ts)}</Td>
        <Td>
          <AuditTypeBadge type={entry.type} />
        </Td>
        <Td className="max-w-[640px] whitespace-normal">
          <div className="text-[15px] text-text">{entry.summary}</div>
          {entry.details ? <div className="mt-0.5 text-[13px] text-muted">{entry.details}</div> : null}
        </Td>
        <Td className="whitespace-nowrap text-muted">{entry.actor}</Td>
      </tr>
    </>
  );
}
