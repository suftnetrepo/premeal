"use client";

import { useState } from "react";

export type Category = { id: string; name: string; sortOrder: number };

export function CategoryManager({
  categories,
  onChange,
}: {
  categories: Category[];
  onChange: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function addCategory() {
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    const res = await fetch("/api/restaurant/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not add category");
      setAdding(false);
      return;
    }
    setNewName("");
    setAdding(false);
    onChange();
  }

  async function saveRename(id: string) {
    if (!editName.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/restaurant/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not rename category");
      setBusy(false);
      return;
    }
    setEditingId(null);
    setBusy(false);
    onChange();
  }

  async function remove(id: string) {
    if (!confirm("Remove this category? Items in it will become uncategorized, not deleted.")) return;
    setBusy(true);
    const res = await fetch(`/api/restaurant/categories/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not remove category");
    }
    setBusy(false);
    onChange();
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    const reordered = [...categories];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setBusy(true);
    await fetch("/api/restaurant/categories/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: reordered.map((c) => c.id) }),
    });
    setBusy(false);
    onChange();
  }

  return (
    <div className="border border-stone-200 rounded-xl p-4 mb-8">
      <p className="text-sm font-medium mb-3">Menu categories</p>
      <p className="text-xs text-stone-500 mb-3">
        Group your menu the way you want — e.g. &quot;Main Meals&quot;, &quot;Sides&quot;, &quot;Drinks&quot;.
        Customers see these as tabs.
      </p>

      <div className="flex flex-col gap-2 mb-3">
        {categories.map((cat, i) =>
          editingId === cat.id ? (
            <div key={cat.id} className="flex items-center gap-2">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1 border border-stone-200 rounded-xl p-1.5 text-sm"
                autoFocus
              />
              <button onClick={() => saveRename(cat.id)} disabled={busy} className="text-xs bg-orange-600 text-white rounded-xl px-2 py-1">
                Save
              </button>
              <button onClick={() => setEditingId(null)} className="text-xs border border-stone-300 rounded-xl px-2 py-1">
                Cancel
              </button>
            </div>
          ) : (
            <div key={cat.id} className="flex items-center gap-2">
              <div className="flex flex-col">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0 || busy}
                  className="text-stone-400 disabled:opacity-30 leading-none text-xs"
                >
                  ▲
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === categories.length - 1 || busy}
                  className="text-stone-400 disabled:opacity-30 leading-none text-xs"
                >
                  ▼
                </button>
              </div>
              <span className="flex-1 text-sm">{cat.name}</span>
              <button
                onClick={() => {
                  setEditingId(cat.id);
                  setEditName(cat.name);
                }}
                className="text-xs border border-stone-300 rounded-xl px-2 py-1"
              >
                Rename
              </button>
              <button
                onClick={() => remove(cat.id)}
                className="text-xs text-red-600 border border-red-200 rounded-xl px-2 py-1"
              >
                Remove
              </button>
            </div>
          )
        )}
        {categories.length === 0 && <p className="text-xs text-stone-400">No categories yet.</p>}
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      <div className="flex gap-2">
        <input
          placeholder="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1 border border-stone-200 rounded-xl p-2 text-sm"
        />
        <button
          onClick={addCategory}
          disabled={adding}
          className="text-sm bg-orange-600 disabled:bg-stone-300 text-white rounded-xl px-3"
        >
          Add
        </button>
      </div>
    </div>
  );
}
