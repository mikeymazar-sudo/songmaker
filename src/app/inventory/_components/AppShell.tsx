"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ChefHat, ClipboardCheck, House, Package, Settings, Store, Truck, Undo2, X, type LucideIcon } from "lucide-react";
import { suggestedQty } from "../_lib/data";
import {
  clearAllData,
  dismissToast,
  loadSampleData,
  setRestaurantName,
  undoToast,
  useInventory,
  useToast,
} from "../_lib/store";
import { Button, Dialog, Field, Skeleton, TextInput, cx, focusRing } from "./ui";

interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { href: "/inventory", label: "Overview", short: "Home", icon: House },
  { href: "/inventory/items", label: "Inventory", short: "Stock", icon: Package },
  { href: "/inventory/count", label: "Count stock", short: "Count", icon: ClipboardCheck },
  { href: "/inventory/orders", label: "Orders", short: "Orders", icon: Truck },
  { href: "/inventory/suppliers", label: "Suppliers", short: "Suppliers", icon: Store },
];

function isActive(pathname: string, href: string) {
  return href === "/inventory" ? pathname === href : pathname.startsWith(href);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const inv = useInventory();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const toOrder = inv ? inv.items.filter((i) => suggestedQty(i, inv.orders) > 0).length : 0;
  const badges: Record<string, number> = { "/inventory/orders": toOrder };

  return (
    <div className="inv-app min-h-dvh bg-[#f6f5f1] font-sans text-stone-900 antialiased">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-stone-900/[0.07] bg-[#efede7] lg:flex">
        <div className="flex items-center gap-3 px-5 pt-6 pb-8">
          <div className="flex size-10 items-center justify-center rounded-xl bg-stone-900 text-white">
            <ChefHat className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            {inv ? (
              <p className="truncate text-[15px] font-semibold text-stone-900">{inv.restaurantName}</p>
            ) : (
              <Skeleton className="h-4 w-32" />
            )}
            <p className="text-[13px] text-stone-500">Inventory</p>
          </div>
        </div>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const badge = badges[item.href];
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors",
                  focusRing,
                  active ? "bg-white text-stone-900 shadow-sm ring-1 ring-stone-900/[0.06]" : "text-stone-600 hover:bg-stone-900/[0.05] hover:text-stone-900",
                )}
              >
                <item.icon className={cx("size-5", active ? "text-stone-900" : "text-stone-500")} aria-hidden />
                <span className="flex-1">{item.label}</span>
                {badge ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 tabular-nums">
                    {badge}
                    <span className="sr-only"> items to order</span>
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-stone-900/[0.07] p-3">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className={cx(
              "flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[15px] font-medium text-stone-600 hover:bg-stone-900/[0.05] hover:text-stone-900",
              focusRing,
            )}
          >
            <Settings className="size-5 text-stone-500" aria-hidden />
            Settings
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-stone-900/[0.07] bg-[#f6f5f1]/90 px-4 backdrop-blur lg:hidden">
        <div className="flex size-8 items-center justify-center rounded-lg bg-stone-900 text-white">
          <ChefHat className="size-4" aria-hidden />
        </div>
        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold">{inv?.restaurantName ?? ""}</p>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className={cx("-mr-2 rounded-lg p-2 text-stone-600 hover:bg-stone-900/5", focusRing)}
          aria-label="Settings"
        >
          <Settings className="size-5" aria-hidden />
        </button>
      </header>

      <main className="px-4 pt-5 pb-28 sm:px-6 lg:ml-64 lg:px-10 lg:pt-10 lg:pb-16">
        <div className="mx-auto max-w-6xl">{inv ? children : <LoadingPage />}</div>
      </main>

      {/* Mobile bottom tabs */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-stone-900/[0.08] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const badge = badges[item.href];
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                focusRing,
                active ? "text-stone-900" : "text-stone-500",
              )}
            >
              <span
                className={cx(
                  "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                  active && "bg-stone-900 text-white",
                )}
              >
                <item.icon className="size-[18px]" aria-hidden />
              </span>
              {item.short}
              {badge ? (
                <span className="absolute top-1.5 left-1/2 ml-3 min-w-5 rounded-full bg-amber-400 px-1 text-center text-[10px] leading-5 font-bold text-stone-900 tabular-nums">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <ToastHost />
      {inv && <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} name={inv.restaurantName} />}
    </div>
  );
}

function LoadingPage() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-3 h-9 w-64" />
      <Skeleton className="mb-8 h-5 w-96 max-w-full" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="mt-6 h-80" />
    </div>
  );
}

function ToastHost() {
  const toast = useToast();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[8.75rem] z-50 flex justify-center px-4 lg:bottom-24 lg:pl-64"
    >
      {toast && (
        <div
          key={toast.id}
          className="inv-toast pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-stone-900 py-2.5 pr-2 pl-4 text-[15px] text-white shadow-xl"
        >
          <span className="flex-1">{toast.message}</span>
          {toast.undo && (
            <button
              type="button"
              onClick={undoToast}
              className={cx(
                "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-amber-300 hover:bg-white/10",
                focusRing,
              )}
            >
              <Undo2 className="size-4" aria-hidden />
              Undo
            </button>
          )}
          <button
            type="button"
            onClick={dismissToast}
            className={cx("rounded-lg p-2 text-stone-400 hover:bg-white/10 hover:text-white", focusRing)}
            aria-label="Dismiss"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

function SettingsDialog({ open, onClose, name }: { open: boolean; onClose: () => void; name: string }) {
  return (
    <Dialog open={open} onClose={onClose} title="Settings" description="Your data is saved in this browser.">
      <SettingsForm name={name} onDone={onClose} />
    </Dialog>
  );
}

function SettingsForm({ name, onDone }: { name: string; onDone: () => void }) {
  const [value, setValue] = useState(name);
  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setRestaurantName(value);
          onDone();
        }}
        className="space-y-3"
      >
        <Field label="Restaurant name" htmlFor="settings-name" hint="Shown at the top of the app and in order messages.">
          <TextInput id="settings-name" value={value} onChange={(e) => setValue(e.target.value)} required />
        </Field>
        <Button type="submit" disabled={!value.trim() || value.trim() === name}>
          Save name
        </Button>
      </form>

      <div className="space-y-3 border-t border-stone-200 pt-5">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">Sample data</h3>
          <p className="mt-0.5 text-[13px] text-stone-500">
            Try the app with a sample restaurant, or clear everything to enter your own items and suppliers. You can undo
            either one right after.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              loadSampleData();
              onDone();
            }}
          >
            Load sample data
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (window.confirm("Remove all items, suppliers and orders? You can undo right after.")) {
                clearAllData();
                onDone();
              }
            }}
          >
            Clear everything
          </Button>
        </div>
      </div>
    </div>
  );
}
