"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { formatMoney } from "@/lib/format";
import { MENU_TEMPLATES } from "@/lib/menu-templates";
import { AddOnsEditor } from "./add-ons-editor";
import { CategoryManager, type Category } from "./category-manager";
import { UtensilsCrossed } from "lucide-react";

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  isAvailable: boolean;
  categoryId: string | null;
};

type DraftFields = { name: string; description: string; price: string; imageUrl: string };

const emptyDraft: DraftFields = { name: "", description: "", price: "", imageUrl: "" };
const UNCATEGORIZED = "__uncategorized__";

function DraftForm({
  value,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  value: DraftFields;
  onChange: (d: DraftFields) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/restaurant/upload-image", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(typeof data.error === "string" ? data.error : "Upload failed");
        return;
      }
      onChange({ ...value, imageUrl: data.url });
    } catch {
      setUploadError("Could not reach the server.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="border border-orange-200 bg-orange-50/40 rounded-xl p-3 flex flex-col gap-2">
      <div className="flex gap-2">
        <div className="shrink-0 flex flex-col items-center gap-1">
          {value.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value.imageUrl}
              alt=""
              className="w-16 h-16 rounded-xl object-cover border border-stone-200"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-stone-100 flex items-center justify-center text-lg border border-stone-200">
              🍽️
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-[11px] text-orange-600 underline disabled:text-stone-400"
          >
            {uploading ? "Uploading…" : "Upload photo"}
          </button>
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <input
            placeholder="Item name"
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            className="border border-stone-200 rounded-xl p-2 text-sm"
          />
          <textarea
            placeholder="Description (what's in it, how it's made)"
            value={value.description}
            onChange={(e) => onChange({ ...value, description: e.target.value })}
            className="border border-stone-200 rounded-xl p-2 text-sm resize-none"
            rows={2}
          />
        </div>
      </div>
      {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
      <div className="flex gap-2">
        <input
          placeholder="Price (£)"
          value={value.price}
          onChange={(e) => onChange({ ...value, price: e.target.value })}
          className="w-24 border border-stone-200 rounded-xl p-2 text-sm"
          inputMode="decimal"
        />
        <input
          placeholder="Or paste a photo URL directly"
          value={value.imageUrl}
          onChange={(e) => onChange({ ...value, imageUrl: e.target.value })}
          className="flex-1 border border-stone-200 rounded-xl p-2 text-sm"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-xs border border-stone-300 rounded-xl px-3 py-1.5">
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="text-xs bg-orange-600 disabled:bg-stone-300 text-white rounded-xl px-3 py-1.5"
        >
          Save
        </button>
      </div>
    </div>
  );
}

export default function MenuPage() {
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [applyingTemplate, setApplyingTemplate] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftFields>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newDraft, setNewDraft] = useState<DraftFields>(emptyDraft);
  const [addonsOpenId, setAddonsOpenId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [itemsRes, categoriesRes] = await Promise.all([
      fetch("/api/restaurant/menu"),
      fetch("/api/restaurant/categories"),
    ]);
    if (itemsRes.ok) setItems((await itemsRes.json()).items);
    if (categoriesRes.ok) setCategories((await categoriesRes.json()).categories);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function applyTemplate(key: string) {
    setApplyingTemplate(key);
    await fetch("/api/restaurant/menu/apply-template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateKey: key }),
    });
    await refresh();
    setApplyingTemplate(null);
  }

  function startEdit(item: MenuItem) {
    setEditingId(item.id);
    setDraft({
      name: item.name,
      description: item.description ?? "",
      price: (item.priceCents / 100).toFixed(2),
      imageUrl: item.imageUrl ?? "",
    });
  }

  function draftToPayload(d: DraftFields) {
    const priceCents = Math.round(parseFloat(d.price) * 100);
    return {
      name: d.name,
      description: d.description || undefined,
      priceCents,
      imageUrl: d.imageUrl || "",
    };
  }

  async function saveEdit(itemId: string) {
    setSaving(true);
    await fetch(`/api/restaurant/menu/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draftToPayload(draft)),
    });
    setEditingId(null);
    await refresh();
    setSaving(false);
  }

  async function addItem() {
    const payload = draftToPayload(newDraft);
    if (!payload.name || !payload.priceCents || payload.priceCents <= 0) return;
    setSaving(true);
    await fetch("/api/restaurant/menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setNewDraft(emptyDraft);
    setAddingNew(false);
    await refresh();
    setSaving(false);
  }

  async function toggleAvailable(item: MenuItem) {
    await fetch(`/api/restaurant/menu/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAvailable: !item.isAvailable }),
    });
    await refresh();
  }

  async function removeItem(item: MenuItem) {
    if (!confirm(`Remove "${item.name}"?`)) return;
    await fetch(`/api/restaurant/menu/${item.id}`, { method: "DELETE" });
    await refresh();
  }

  async function setCategory(item: MenuItem, categoryId: string) {
    await fetch(`/api/restaurant/menu/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: categoryId === UNCATEGORIZED ? null : categoryId }),
    });
    await refresh();
  }

  if (!items) {
    return (
      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-10 w-full">
        <p className="text-sm text-stone-400">Loading…</p>
      </main>
    );
  }

  function ItemRow(item: MenuItem) {
    return editingId === item.id ? (
      <DraftForm
        key={item.id}
        value={draft}
        onChange={setDraft}
        onSave={() => saveEdit(item.id)}
        onCancel={() => setEditingId(null)}
        saving={saving}
      />
    ) : (
      <div key={item.id} className="border border-stone-200 rounded-xl overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3">
          <div className="flex items-start gap-3 min-w-0">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-14 h-14 rounded-xl object-cover border border-stone-200 shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-stone-100 flex items-center justify-center text-lg shrink-0">
                🍽️
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${!item.isAvailable ? "text-stone-400 line-through" : ""}`}>
                {item.name}
              </p>
              {item.description && <p className="text-xs text-stone-500 truncate">{item.description}</p>}
              <p className="text-xs text-stone-500">{formatMoney(item.priceCents)}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <select
              value={item.categoryId ?? UNCATEGORIZED}
              onChange={(e) => setCategory(item, e.target.value)}
              className="text-xs border border-stone-300 rounded-xl px-1.5 py-1 shrink-0"
            >
              <option value={UNCATEGORIZED}>Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button onClick={() => startEdit(item)} className="text-xs border border-stone-300 rounded-xl px-2 py-1">
              Edit
            </button>
            <button
              onClick={() => setAddonsOpenId(addonsOpenId === item.id ? null : item.id)}
              className="text-xs border border-stone-300 rounded-xl px-2 py-1"
            >
              Add-ons
            </button>
            <button onClick={() => toggleAvailable(item)} className="text-xs border border-stone-300 rounded-xl px-2 py-1">
              {item.isAvailable ? "Hide" : "Show"}
            </button>
            <button
              onClick={() => removeItem(item)}
              className="text-xs text-red-600 border border-red-200 rounded-xl px-2 py-1"
            >
              Remove
            </button>
          </div>
        </div>
        {addonsOpenId === item.id && <AddOnsEditor itemId={item.id} />}
      </div>
    );
  }

  const uncategorizedItems = items.filter((i) => !i.categoryId);

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-10 w-full">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
          <UtensilsCrossed size={16} strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-black tracking-tight text-stone-900">Menu</h1>
      </div>
      <p className="text-sm text-stone-500 mb-8">
        Customers only see items marked available. Add a photo and description to help items sell.
      </p>

      <CategoryManager categories={categories} onChange={refresh} />

      {items.length === 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-medium text-stone-500 mb-3">
            Quick start — pick a template to fill in a starter menu
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {MENU_TEMPLATES.map((template) => (
              <button
                key={template.key}
                onClick={() => applyTemplate(template.key)}
                disabled={applyingTemplate !== null}
                className="text-left border border-stone-200 rounded-xl p-4 hover:border-orange-300"
              >
                <p className="font-medium text-sm">{template.label}</p>
                <p className="text-xs text-stone-500 mt-1">
                  {template.items.map((i) => i.name).join(" · ")}
                </p>
                {applyingTemplate === template.key && (
                  <p className="text-xs text-orange-600 mt-2">Adding…</p>
                )}
              </button>
            ))}
          </div>
          <p className="text-xs text-stone-400 mt-3">
            You can edit, remove, or add to this after — it&apos;s just a starting point.
          </p>
        </section>
      )}

      {categories.map((cat) => {
        const catItems = items.filter((i) => i.categoryId === cat.id);
        if (catItems.length === 0) return null;
        return (
          <section key={cat.id} className="mb-8">
            <h2 className="text-sm font-medium text-stone-700 mb-3">{cat.name}</h2>
            <div className="flex flex-col gap-2">{catItems.map(ItemRow)}</div>
          </section>
        );
      })}

      {uncategorizedItems.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-medium text-stone-500 mb-3">
            {categories.length > 0 ? "Uncategorized" : "All items"}
          </h2>
          <div className="flex flex-col gap-2">{uncategorizedItems.map(ItemRow)}</div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-stone-500">Add an item</h2>
          {!addingNew && (
            <button onClick={() => setAddingNew(true)} className="text-xs text-orange-600">
              + New item
            </button>
          )}
        </div>
        {addingNew && (
          <DraftForm
            value={newDraft}
            onChange={setNewDraft}
            onSave={addItem}
            onCancel={() => {
              setAddingNew(false);
              setNewDraft(emptyDraft);
            }}
            saving={saving}
          />
        )}
      </section>
    </main>
  );
}
