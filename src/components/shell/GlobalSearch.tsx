"use client";

import { FileText, Package, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { fmtDate, money } from "@/lib/format";
import { useApp } from "@/lib/store";

export function GlobalSearch() {
  const { state, setUi } = useApp();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return { products: [], invoices: [] as typeof state.invoices };
    const products = state.products
      .filter((p) => !p.archived && (p.name.toLowerCase().includes(t) || p.category.toLowerCase().includes(t)))
      .slice(0, 6);
    const invoices = state.invoices
      .filter((i) => {
        const vendor = state.vendors.find((v) => v.id === i.vendorId);
        return i.invoiceNumber.toLowerCase().includes(t) || (vendor?.name.toLowerCase().includes(t) ?? false);
      })
      .slice(0, 4);
    return { products, invoices };
  }, [q, state]);

  const hasResults = results.products.length > 0 || results.invoices.length > 0;

  return (
    <div ref={boxRef} className="relative w-full">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && q.trim()) {
            setUi({ productQuery: q.trim(), selectedProductId: null, nonce: Date.now() });
            router.push("/products");
            setOpen(false);
          }
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Search any product, vendor or invoice"
        aria-label="Global search"
        className="h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-[15px] text-text placeholder:text-muted focus:border-text focus:outline-none focus:ring-2 focus:ring-ring/25"
      />
      {open && q.trim().length >= 2 ? (
        <div className="absolute left-0 right-0 top-13 z-40 overflow-hidden rounded-2xl border border-border bg-surface p-1.5 shadow-xl">
          {!hasResults ? (
            <div className="px-4 py-3 text-sm text-muted">No matches for “{q.trim()}”.</div>
          ) : null}
          {results.products.length > 0 ? (
            <div>
              <div className="px-3 pb-1 pt-2 text-[13px] font-medium text-muted">Products</div>
              {results.products.map((p) => (
                <button
                  key={p.id}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface-3"
                  onClick={() => {
                    setUi({ productQuery: p.name, selectedProductId: p.id, nonce: Date.now() });
                    router.push("/products");
                    setQ("");
                    setOpen(false);
                  }}
                >
                  <Package className="h-4 w-4 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text">{p.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {p.category} · {p.packSize}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          {results.invoices.length > 0 ? (
            <div className="mt-1 border-t border-border pt-1">
              <div className="px-3 pb-1 pt-2 text-[13px] font-medium text-muted">Invoices</div>
              {results.invoices.map((i) => {
                const vendor = state.vendors.find((v) => v.id === i.vendorId);
                return (
                  <button
                    key={i.id}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface-3"
                    onClick={() => {
                      setUi({ selectedInvoiceId: i.id, nonce: Date.now() });
                      router.push("/invoices");
                      setQ("");
                      setOpen(false);
                    }}
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-text">
                        {vendor?.name} · #{i.invoiceNumber}
                      </span>
                      <span className="block text-xs text-muted">
                        {fmtDate(i.date)} · {money(i.total)} · {i.status === "needs-review" ? "needs checking" : i.status}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
