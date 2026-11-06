"use client";

import { useState } from "react";
import { Mail, Pencil, Phone, Plus, Store, Trash2 } from "lucide-react";
import { WEEKDAYS, type Supplier, type Weekday, newId, timeAgo } from "../_lib/data";
import { deleteSupplier, saveSupplier, useInventory, useNow } from "../_lib/store";
import { Button, Card, EmptyState, Field, PageHeader, Sheet, TextInput, cx, focusRing, inputClass } from "./ui";

type SheetState = { mode: "edit"; id: string } | { mode: "new" } | null;

export function SuppliersView() {
  const inv = useInventory();
  const now = useNow();
  const [sheet, setSheet] = useState<SheetState>(null);

  if (!inv) return null;

  const editing = sheet?.mode === "edit" ? (inv.suppliers.find((s) => s.id === sheet.id) ?? null) : null;
  const suppliers = [...inv.suppliers].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <PageHeader
        title="Suppliers"
        description="Who you buy from, how to reach them, and which days they deliver."
        actions={
          <Button icon={Plus} onClick={() => setSheet({ mode: "new" })}>
            Add supplier
          </Button>
        }
      />

      {suppliers.length === 0 ? (
        <Card>
          <EmptyState
            icon={Store}
            title="No suppliers yet"
            action={
              <Button icon={Plus} onClick={() => setSheet({ mode: "new" })}>
                Add your first supplier
              </Button>
            }
          >
            Add the companies you order from so we can group your orders and remind you of delivery days.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {suppliers.map((s) => {
            const itemCount = inv.items.filter((i) => i.supplierId === s.id).length;
            const lastOrder = inv.orders
              .filter((o) => o.supplierId === s.id)
              .reduce((max, o) => Math.max(max, o.createdAt), 0);
            return (
              <Card key={s.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-[17px] font-semibold tracking-tight">{s.name}</h2>
                    {s.contact && <p className="text-sm text-stone-500">{s.contact}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Pencil}
                    onClick={() => setSheet({ mode: "edit", id: s.id })}
                    aria-label={`Edit ${s.name}`}
                    className="-mt-1 -mr-2"
                  />
                </div>

                <div className="mt-4 space-y-1.5 text-[15px]">
                  {s.phone && (
                    <a
                      href={`tel:${s.phone}`}
                      className={cx("flex items-center gap-2 text-stone-700 hover:text-stone-900", focusRing)}
                    >
                      <Phone className="size-4 text-stone-400" aria-hidden />
                      {s.phone}
                    </a>
                  )}
                  {s.email && (
                    <a
                      href={`mailto:${s.email}`}
                      className={cx("flex items-center gap-2 text-stone-700 hover:text-stone-900", focusRing)}
                    >
                      <Mail className="size-4 shrink-0 text-stone-400" aria-hidden />
                      <span className="truncate">{s.email}</span>
                    </a>
                  )}
                </div>

                <div className="mt-4">
                  <p className="mb-1.5 text-[13px] font-medium text-stone-500">Delivers on</p>
                  <ul className="flex gap-1" aria-label="Delivery days">
                    {WEEKDAYS.map((d) => {
                      const on = s.deliveryDays.includes(d);
                      return (
                        <li
                          key={d}
                          className={cx(
                            "flex h-8 flex-1 items-center justify-center rounded-lg text-[12px] font-semibold",
                            on ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-400",
                          )}
                        >
                          <span aria-hidden>{d.slice(0, 2)}</span>
                          <span className="sr-only">
                            {d}: {on ? "delivers" : "no delivery"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {s.notes && <p className="mt-4 rounded-xl bg-stone-100/80 px-3 py-2 text-sm text-stone-700">{s.notes}</p>}

                <div className="flex-1" />
                <p className="mt-4 border-t border-stone-100 pt-3 text-[13px] text-stone-500">
                  {itemCount} item{itemCount === 1 ? "" : "s"} · Last order {lastOrder ? timeAgo(lastOrder, now).toLowerCase() : "never"}
                </p>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet
        open={sheet !== null && (sheet.mode === "new" || editing !== null)}
        onClose={() => setSheet(null)}
        title={editing ? editing.name : "Add a supplier"}
        description={editing ? "Edit contact details and delivery days." : "A company you buy from."}
      >
        <SupplierForm
          key={editing?.id ?? "new"}
          supplier={editing}
          itemCount={editing ? inv.items.filter((i) => i.supplierId === editing.id).length : 0}
          onDone={() => setSheet(null)}
        />
      </Sheet>
    </div>
  );
}

function SupplierForm({
  supplier,
  itemCount,
  onDone,
}: {
  supplier: Supplier | null;
  itemCount: number;
  onDone: () => void;
}) {
  const [name, setName] = useState(supplier?.name ?? "");
  const [contact, setContact] = useState(supplier?.contact ?? "");
  const [phone, setPhone] = useState(supplier?.phone ?? "");
  const [email, setEmail] = useState(supplier?.email ?? "");
  const [days, setDays] = useState<Weekday[]>(supplier?.deliveryDays ?? []);
  const [notes, setNotes] = useState(supplier?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const toggle = (d: Weekday) =>
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : WEEKDAYS.filter((w) => w === d || cur.includes(w))));

  return (
    <form
      className="flex min-h-full flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return setError("Give the supplier a name.");
        saveSupplier({
          id: supplier?.id ?? newId("sup"),
          name: name.trim(),
          contact: contact.trim(),
          phone: phone.trim(),
          email: email.trim(),
          deliveryDays: days,
          notes: notes.trim(),
        });
        onDone();
      }}
    >
      <div className="flex-1 space-y-5">
        <Field label="Company name" htmlFor="sup-name">
          <TextInput
            id="sup-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Fresh Valley Produce"
            autoFocus={!supplier}
          />
        </Field>
        <Field label="Your contact there" htmlFor="sup-contact" hint="Used to greet them in order messages.">
          <TextInput id="sup-contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Name" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Phone" htmlFor="sup-phone">
            <TextInput
              id="sup-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 000-0000"
            />
          </Field>
          <Field label="Email" htmlFor="sup-email">
            <TextInput
              id="sup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="orders@…"
            />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-stone-800">Delivery days</legend>
          <div className="flex gap-1.5">
            {WEEKDAYS.map((d) => {
              const on = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(d)}
                  className={cx(
                    "h-11 flex-1 rounded-xl text-sm font-semibold transition-colors",
                    focusRing,
                    on ? "bg-stone-900 text-white" : "bg-white text-stone-600 ring-1 ring-stone-300 ring-inset hover:bg-stone-50",
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[13px] text-stone-500">We use this to show when your next delivery should arrive.</p>
        </fieldset>
        <Field label="Notes" htmlFor="sup-notes" hint="Order cutoffs, minimums, anything to remember.">
          <textarea
            id="sup-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="e.g. Order by 2 pm for next-day delivery"
            className={cx(inputClass, "h-auto resize-y py-2.5")}
          />
        </Field>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
      </div>

      <div className="sticky bottom-0 -mx-5 mt-8 -mb-5 flex items-center gap-2 border-t border-stone-200 bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {supplier && (
          <Button
            variant="danger"
            icon={Trash2}
            disabled={itemCount > 0}
            title={itemCount > 0 ? `Move its ${itemCount} items to another supplier first` : undefined}
            onClick={() => {
              if (window.confirm(`Remove ${supplier.name}?`)) {
                deleteSupplier(supplier.id);
                onDone();
              }
            }}
          >
            <span className="sr-only sm:not-sr-only">Remove</span>
          </Button>
        )}
        <div className="flex-1" />
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{supplier ? "Save changes" : "Add supplier"}</Button>
      </div>
    </form>
  );
}
