"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { List, Row } from "@/components/ui/List";
import { useOverlay } from "@/components/ui/Overlay";
import { fmtDate, money } from "@/lib/format";
import { useApp } from "@/lib/store";

export function GlobalSearch() {
  const { state, setUi } = useApp();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
  }, []);
  useOverlay(open, close);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return { products: [], invoices: [] as typeof state.invoices };
    const products = state.products
      .filter((p) => !p.archived && (p.name.toLowerCase().includes(t) || p.category.toLowerCase().includes(t)))
      .slice(0, 8);
    const invoices = state.invoices
      .filter((i) => {
        const vendor = state.vendors.find((v) => v.id === i.vendorId);
        return i.invoiceNumber.toLowerCase().includes(t) || (vendor?.name.toLowerCase().includes(t) ?? false);
      })
      .slice(0, 5);
    return { products, invoices };
  }, [q, state]);

  const searched = q.trim().length >= 2;
  const hasResults = results.products.length > 0 || results.invoices.length > 0;

  return (
    <>
      <button
        type="button"
        aria-label="Search"
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-text active:bg-surface-3 md:hover:bg-surface-3"
      >
        <Search className="h-5 w-5" strokeWidth={1.75} />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 md:flex md:items-start md:justify-center md:pt-20" role="dialog" aria-modal="true" aria-label="Search">
          <button aria-label="Close search" tabIndex={-1} className="absolute inset-0 hidden bg-black/30 md:block" onClick={close} />
          <div className="sheet-in relative flex h-full flex-col bg-surface pt-[env(safe-area-inset-top)] md:h-auto md:max-h-[70dvh] md:w-full md:max-w-xl md:rounded-3xl">
            <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border pl-4 pr-2 md:h-16 md:pl-5">
              <Search className="h-5 w-5 shrink-0 text-muted" strokeWidth={1.75} />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && q.trim()) {
                    setUi({ productQuery: q.trim(), selectedProductId: null, nonce: Date.now() });
                    router.push("/products");
                    close();
                  }
                }}
                enterKeyHint="search"
                placeholder="Items, vendors, invoices"
                aria-label="Search"
                className="h-full min-w-0 flex-1 bg-transparent text-base text-text placeholder:text-muted focus:outline-none"
              />
              <button type="button" onClick={close} className="h-11 shrink-0 px-3 text-[15px] font-medium text-text-2">
                Cancel
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[env(safe-area-inset-bottom)] md:px-5">
              {searched && !hasResults ? <p className="py-6 text-[15px] text-muted">No matches for “{q.trim()}”.</p> : null}
              {results.products.length > 0 ? (
                <List>
                  {results.products.map((p) => (
                    <li key={p.id}>
                      <Row
                        title={p.name}
                        subtitle={`${p.category} · ${p.packSize}`}
                        onClick={() => {
                          setUi({ productQuery: p.name, selectedProductId: p.id, nonce: Date.now() });
                          router.push("/products");
                          close();
                        }}
                      />
                    </li>
                  ))}
                </List>
              ) : null}
              {results.invoices.length > 0 ? (
                <List className={results.products.length > 0 ? "border-t border-border" : undefined}>
                  {results.invoices.map((i) => {
                    const vendor = state.vendors.find((v) => v.id === i.vendorId);
                    return (
                      <li key={i.id}>
                        <Row
                          title={`${vendor?.name} #${i.invoiceNumber}`}
                          subtitle={`${fmtDate(i.date)} · ${i.status === "needs-review" ? "needs checking" : i.status}`}
                          value={money(i.total)}
                          onClick={() => {
                            setUi({ selectedInvoiceId: i.id, nonce: Date.now() });
                            router.push("/invoices");
                            close();
                          }}
                        />
                      </li>
                    );
                  })}
                </List>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
