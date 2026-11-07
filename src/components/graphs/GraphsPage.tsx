"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, Td, Th } from "@/components/ui/Table";
import { Tabs } from "@/components/ui/Tabs";
import type { VendorId } from "@/data/types";
import { fmtDate, fmtShortDate, money, moneyWhole, toISODate } from "@/lib/format";
import { useApp } from "@/lib/store";
import { priceTrends, weeklySpend, type PriceTrend, type WeekSpend } from "@/lib/trends";

type View = "spend" | "prices";
type VendorName = (id: VendorId) => string;

const TOTAL_LABELS_MAX_WEEKS = 8;
const tick = { fill: "var(--muted)", fontSize: 12 };
const axisLine = { stroke: "var(--border-strong)" };
const vendorColor = (id: VendorId) => `var(--series-${id})`;

function axisMoney(value: number): string {
  return value >= 10_000 ? `$${Math.round(value / 1000)}K` : moneyWhole(value);
}

function Stage({ title, legend, children }: { title: string; legend?: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-4 flex h-[23rem] flex-col md:h-[28rem] phone-landscape:mt-1 phone-landscape:h-[calc(100dvh-4rem)]">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pb-2">
        <p className="text-[13px] font-medium text-text-2">{title}</p>
        {legend}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function Legend({ vendors, name }: { vendors: VendorId[]; name: VendorName }) {
  if (vendors.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {vendors.map((id) => (
        <li key={id} className="flex items-center gap-1.5 text-[13px] text-text-2">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: vendorColor(id) }} aria-hidden />
          {name(id)}
        </li>
      ))}
    </ul>
  );
}

function TipBox({ title, rows, total }: { title: string; rows: Array<{ id: VendorId; label: string; value: string }>; total?: string }) {
  return (
    <div className="min-w-44 rounded-xl border border-border bg-surface px-3 py-2 text-[13px] shadow-lg">
      <div className="pb-1 font-medium text-text">{title}</div>
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-2 py-0.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: vendorColor(r.id) }} aria-hidden />
          <span className="flex-1 text-text-2">{r.label}</span>
          <span className="tabular font-medium text-text">{r.value}</span>
        </div>
      ))}
      {total ? (
        <div className="mt-1 flex justify-between gap-3 border-t border-border pt-1 font-medium text-text">
          <span>Total</span>
          <span className="tabular">{total}</span>
        </div>
      ) : null}
    </div>
  );
}

function Numbers({ children }: { children: ReactNode }) {
  return (
    <details className="mt-4 phone-landscape:mt-2">
      <summary className="flex h-10 cursor-pointer list-none items-center text-sm font-medium text-text-2">See the numbers</summary>
      <div className="overflow-x-auto">{children}</div>
    </details>
  );
}

interface SegmentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: WeekSpend;
}

/** One vendor's piece of a week's column: 2px gap above it, or a rounded cap and the total if it's on top. */
function Segment({ x = 0, y = 0, width = 0, height = 0, payload, vendorId, vendors, showTotal }: SegmentProps & { vendorId: VendorId; vendors: VendorId[]; showTotal: boolean }) {
  if (!payload || height <= 0) return null;
  const top = vendors.filter((id) => (payload[id] ?? 0) > 0).at(-1) === vendorId;
  const gap = top ? 0 : 2;
  const h = Math.max(0, height - gap);
  const yTop = y + gap;
  const r = top ? Math.min(4, h, width / 2) : 0;
  const d = `M${x},${yTop + h}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + width - r}Q${x + width},${yTop} ${x + width},${yTop + r}V${yTop + h}Z`;
  return (
    <>
      <path d={d} fill={vendorColor(vendorId)} />
      {top && showTotal ? (
        <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={12} fill="var(--text-2)" className="tabular">
          {moneyWhole(payload.total)}
        </text>
      ) : null}
    </>
  );
}

function SpendGraph({ rows, name }: { rows: WeekSpend[]; name: VendorName }) {
  const { state } = useApp();
  const vendors = state.vendors.map((v) => v.id).filter((id) => rows.some((r) => (r[id] ?? 0) > 0));
  const showTotal = rows.length <= TOTAL_LABELS_MAX_WEEKS;

  return (
    <>
      <Stage title="Spending by week, fees and tax included" legend={<Legend vendors={vendors} name={name} />}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={rows} margin={{ top: 22, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="week" tick={tick} tickLine={false} axisLine={axisLine} tickFormatter={fmtShortDate} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tick={tick} tickLine={false} axisLine={false} tickFormatter={axisMoney} width={58} />
            <Tooltip
              cursor={{ fill: "var(--surface-3)" }}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as WeekSpend | undefined;
                if (!active || !row) return null;
                return (
                  <TipBox
                    title={`Week of ${fmtShortDate(row.week)}`}
                    rows={vendors.filter((id) => row[id]).map((id) => ({ id, label: name(id), value: money(row[id] ?? 0) }))}
                    total={money(row.total)}
                  />
                );
              }}
            />
            {vendors.map((id) => (
              <Bar
                key={id}
                dataKey={id}
                stackId="spend"
                maxBarSize={24}
                isAnimationActive={false}
                shape={(props: SegmentProps) => <Segment {...props} vendorId={id} vendors={vendors} showTotal={showTotal} />}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Stage>
      <Numbers>
        <Table>
          <thead>
            <tr>
              <Th>Week of</Th>
              {vendors.map((id) => (
                <Th key={id} align="right">
                  {name(id)}
                </Th>
              ))}
              <Th align="right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.week}>
                <Td className="whitespace-nowrap">{fmtShortDate(r.week)}</Td>
                {vendors.map((id) => (
                  <Td key={id} align="right">
                    {r[id] ? money(r[id]) : "—"}
                  </Td>
                ))}
                <Td align="right" className="font-medium">
                  {money(r.total)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Numbers>
    </>
  );
}

/** Where each vendor's latest price sits, and which side of the dot its label goes so close prices don't collide. */
function endLabels(trend: PriceTrend) {
  const prices = trend.rows.flatMap((r) => trend.vendors.flatMap((id) => (r[id] === undefined ? [] : [r[id]])));
  const range = Math.max(...prices) - Math.min(...prices) || 1;
  const ends = trend.vendors
    .map((id) => {
      const index = trend.rows.findLastIndex((r) => r[id] !== undefined);
      return { id, index, value: trend.rows[index][id] ?? 0 };
    })
    .sort((a, b) => b.value - a.value);

  const labels = new Map<VendorId, { index: number; value: number; above: boolean }>();
  const lastOnDate = new Map<number, { value: number; above: boolean }>();
  for (const end of ends) {
    const neighbor = lastOnDate.get(end.index);
    const crowded = neighbor !== undefined && neighbor.value - end.value < range * 0.15;
    const above = !(crowded && neighbor.above);
    labels.set(end.id, { index: end.index, value: end.value, above });
    lastOnDate.set(end.index, { value: end.value, above });
  }
  return labels;
}

function PriceGraph({ trend, name }: { trend: PriceTrend; name: VendorName }) {
  const labels = endLabels(trend);
  const dates = trend.rows.map((r) => r.t);

  return (
    <>
      <Stage title={`Price per ${trend.product.baseUnit}, fees included`} legend={<Legend vendors={trend.vendors} name={name} />}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={trend.rows} margin={{ top: 24, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              ticks={dates}
              tick={tick}
              tickLine={false}
              axisLine={axisLine}
              tickFormatter={(t: number) => fmtShortDate(toISODate(new Date(t)))}
              interval="preserveStartEnd"
              minTickGap={16}
              padding={{ left: 12, right: 12 }}
            />
            <YAxis tick={tick} tickLine={false} axisLine={false} tickFormatter={(v: number) => money(v)} domain={["auto", "auto"]} width={62} padding={{ top: 8, bottom: 24 }} />
            <Tooltip
              cursor={{ stroke: "var(--border-strong)" }}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as PriceTrend["rows"][number] | undefined;
                if (!active || !row) return null;
                return (
                  <TipBox
                    title={fmtDate(row.date)}
                    rows={trend.vendors.filter((id) => row[id] !== undefined).map((id) => ({ id, label: name(id), value: money(row[id] ?? 0) }))}
                  />
                );
              }}
            />
            {trend.vendors.map((id) => {
              const color = vendorColor(id);
              const end = labels.get(id);
              return (
                <Line
                  key={id}
                  dataKey={id}
                  type="stepAfter"
                  connectNulls
                  stroke={color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={{ r: 4, fill: color, stroke: "var(--surface)", strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: color, stroke: "var(--surface)", strokeWidth: 2 }}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey={id}
                    content={(p) => {
                      if (!end || p.index !== end.index) return null;
                      const leftSide = end.index < trend.rows.length / 2;
                      return (
                        <text
                          x={Number(p.x) + (leftSide ? -4 : 4)}
                          y={Number(p.y) + (end.above ? -11 : 19)}
                          textAnchor={leftSide ? "start" : "end"}
                          fontSize={12}
                          fill="var(--text-2)"
                          stroke="var(--surface)"
                          strokeWidth={3}
                          paintOrder="stroke"
                          className="tabular"
                        >
                          {name(id)} {money(end.value)}
                        </text>
                      );
                    }}
                  />
                </Line>
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </Stage>
      <Numbers>
        <Table>
          <thead>
            <tr>
              <Th>Date</Th>
              {trend.vendors.map((id) => (
                <Th key={id} align="right">
                  {name(id)}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trend.rows.map((r) => (
              <tr key={r.date}>
                <Td className="whitespace-nowrap">{fmtShortDate(r.date)}</Td>
                {trend.vendors.map((id) => (
                  <Td key={id} align="right">
                    {r[id] === undefined ? "—" : money(r[id])}
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </Numbers>
    </>
  );
}

export function GraphsPage() {
  const { state } = useApp();
  const [view, setView] = useState<View>("spend");
  const [itemId, setItemId] = useState<string | null>(null);

  const spend = useMemo(() => weeklySpend(state), [state]);
  const trends = useMemo(() => priceTrends(state), [state]);
  const trend = trends.find((t) => t.product.id === itemId) ?? trends[0];
  const picker = useMemo(() => [...trends].sort((a, b) => a.product.name.localeCompare(b.product.name)), [trends]);
  const name: VendorName = (id) => state.vendors.find((v) => v.id === id)?.shortName ?? id;

  return (
    <>
      <div className="phone-landscape:hidden">
        <PageHeader title="Graphs" />
      </div>
      <p className="-mt-3 mb-3 text-[13px] text-muted md:hidden landscape:hidden">Turn your phone sideways for a bigger graph.</p>

      <div className="flex flex-col gap-3 phone-landscape:flex-row phone-landscape:items-center">
        <Tabs
          className="phone-landscape:flex-1"
          value={view}
          onChange={setView}
          options={[
            { value: "spend" as View, label: "Spending" },
            { value: "prices" as View, label: "Item prices" },
          ]}
        />
        {view === "prices" && trend ? (
          <Select
            value={trend.product.id}
            onChange={(e) => setItemId(e.target.value)}
            aria-label="Item to graph"
            className="md:w-96 phone-landscape:h-10! phone-landscape:w-72!"
          >
            {picker.map((t) => (
              <option key={t.product.id} value={t.product.id}>
                {t.product.name}
              </option>
            ))}
          </Select>
        ) : null}
      </div>

      {view === "spend" ? (
        spend.length > 0 ? (
          <SpendGraph rows={spend} name={name} />
        ) : (
          <EmptyState title="No spending yet" description="Approve an invoice and it shows up here." />
        )
      ) : trend ? (
        <PriceGraph key={trend.product.id} trend={trend} name={name} />
      ) : (
        <EmptyState title="Not enough prices yet" description="An item needs prices from two different dates. They come in as you approve invoices." />
      )}
    </>
  );
}
