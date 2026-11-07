"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormRow, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Overlay";
import { CATEGORIES, UNITS, type Category, type Unit, type VendorId } from "@/data/types";
import { slugify } from "@/lib/format";
import type { ProductRecord } from "@/lib/models";
import { useActions, useApp } from "@/lib/store";

export interface ProductFormDefaults {
  name?: string;
  category?: Category;
  packSize?: string;
  baseUnit?: Unit;
  preferredVendorId?: VendorId;
}

interface ProductFormProps {
  open: boolean;
  onClose: () => void;
  product?: ProductRecord;
  defaults?: ProductFormDefaults;
  onSaved?: (product: ProductRecord) => void;
}

export function ProductFormModal(props: ProductFormProps) {
  if (!props.open) return null;
  return <ProductFormInner {...props} />;
}

function ProductFormInner({ open, onClose, product, defaults, onSaved }: ProductFormProps) {
  const { state } = useApp();
  const actions = useActions();
  const [name, setName] = useState(product?.name ?? defaults?.name ?? "");
  const [category, setCategory] = useState<Category>(product?.category ?? defaults?.category ?? "Dry Goods / Pantry / Oils");
  const [packSize, setPackSize] = useState(product?.packSize ?? defaults?.packSize ?? "");
  const [baseUnit, setBaseUnit] = useState<Unit>(product?.baseUnit ?? defaults?.baseUnit ?? "case");
  const [parLevel, setParLevel] = useState(String(product?.parLevel ?? 2));
  const [onHand, setOnHand] = useState(String(product?.onHand ?? 0));
  const [preferred, setPreferred] = useState<VendorId | "">(product?.preferredVendorId ?? defaults?.preferredVendorId ?? "");
  const [notes, setNotes] = useState(product?.notes ?? "");

  const valid = name.trim().length > 1 && packSize.trim().length > 0;

  const save = () => {
    if (!valid) return;
    let id = product?.id ?? slugify(name);
    if (!product) {
      let n = 1;
      const base = id;
      while (state.products.some((p) => p.id === id)) {
        n += 1;
        id = `${base}-${n}`;
      }
    }
    const next: ProductRecord = {
      ...(product ?? {}),
      id,
      name: name.trim(),
      category,
      packSize: packSize.trim(),
      baseUnit,
      parLevel: Math.max(0, Number(parLevel) || 0),
      onHand: Math.max(0, Number(onHand) || 0),
      preferredVendorId: preferred || undefined,
      notes: notes.trim() || undefined,
    };
    actions.upsertProduct(next);
    onSaved?.(next);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? "Edit item" : "Add an item"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!valid}>
            {product ? "Save" : "Add item"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormRow label="Name" className="sm:col-span-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken Breast Boneless" autoFocus />
        </FormRow>
        <FormRow label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Typical pack size">
          <Input value={packSize} onChange={(e) => setPackSize(e.target.value)} placeholder="e.g. 2 / 20 lb" />
        </FormRow>
        <FormRow label="Compare prices per" hint="Every vendor's price is converted to this unit so they can be compared fairly.">
          <Select value={baseUnit} onChange={(e) => setBaseUnit(e.target.value as Unit)}>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Usual vendor" hint="Wins when two prices are tied.">
          <Select value={preferred} onChange={(e) => setPreferred(e.target.value as VendorId | "")}>
            <option value="">No favorite</option>
            {state.vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Par (full shelf)" hint="How much you want after a delivery.">
          <Input type="number" inputMode="decimal" min={0} value={parLevel} onChange={(e) => setParLevel(e.target.value)} />
        </FormRow>
        <FormRow label="On hand now">
          <Input type="number" inputMode="decimal" min={0} value={onHand} onChange={(e) => setOnHand(e.target.value)} />
        </FormRow>
        <FormRow label="Notes" className="sm:col-span-2">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Brand, grade, anything worth remembering" />
        </FormRow>
      </div>
    </Modal>
  );
}
