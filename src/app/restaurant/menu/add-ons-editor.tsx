"use client";

import { useEffect, useState, useCallback } from "react";
import { formatMoney } from "@/lib/format";

type Option = { id?: string; name: string; priceDeltaCents: number };
type Group = { id: string; name: string; minSelect: number; maxSelect: number; options: Option[] };

const emptyGroupDraft = { name: "", minSelect: 0, maxSelect: 1, options: [{ name: "", priceDeltaCents: 0 }] as Option[] };

function GroupForm({
  draft,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  draft: typeof emptyGroupDraft;
  onChange: (d: typeof emptyGroupDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  function updateOption(index: number, field: "name" | "price", value: string) {
    const options = [...draft.options];
    if (field === "name") options[index] = { ...options[index], name: value };
    else {
      const parsed = Math.round(parseFloat(value || "0") * 100);
      options[index] = { ...options[index], priceDeltaCents: Number.isNaN(parsed) ? 0 : parsed };
    }
    onChange({ ...draft, options });
  }

  function addOptionRow() {
    onChange({ ...draft, options: [...draft.options, { name: "", priceDeltaCents: 0 }] });
  }

  function removeOptionRow(index: number) {
    onChange({ ...draft, options: draft.options.filter((_, i) => i !== index) });
  }

  return (
    <div className="border border-orange-200 bg-orange-50/40 rounded-xl p-3 flex flex-col gap-2">
      <input
        placeholder='Group name (e.g. "Choice of protein", "Extras")'
        value={draft.name}
        onChange={(e) => onChange({ ...draft, name: e.target.value })}
        className="border border-stone-200 rounded-xl p-2 text-sm"
      />
      <div className="flex gap-2">
        <label className="text-xs text-stone-500 flex-1">
          Min select (0 = optional)
          <input
            type="number"
            min={0}
            value={draft.minSelect}
            onChange={(e) => onChange({ ...draft, minSelect: Number(e.target.value) })}
            className="mt-1 w-full border border-stone-200 rounded-xl p-2 text-sm"
          />
        </label>
        <label className="text-xs text-stone-500 flex-1">
          Max select (1 = single choice)
          <input
            type="number"
            min={1}
            value={draft.maxSelect}
            onChange={(e) => onChange({ ...draft, maxSelect: Number(e.target.value) })}
            className="mt-1 w-full border border-stone-200 rounded-xl p-2 text-sm"
          />
        </label>
      </div>
      <p className="text-xs text-stone-500 mt-1">Options</p>
      {draft.options.map((option, i) => (
        <div key={i} className="flex gap-2">
          <input
            placeholder="Option name"
            value={option.name}
            onChange={(e) => updateOption(i, "name", e.target.value)}
            className="flex-1 border border-stone-200 rounded-xl p-2 text-sm"
          />
          <input
            placeholder="+£ (0 for no charge)"
            value={(option.priceDeltaCents / 100).toString()}
            onChange={(e) => updateOption(i, "price", e.target.value)}
            className="w-28 border border-stone-200 rounded-xl p-2 text-sm"
            inputMode="decimal"
          />
          <button
            onClick={() => removeOptionRow(i)}
            className="text-xs text-red-600 border border-red-200 rounded-xl px-2"
          >
            ✕
          </button>
        </div>
      ))}
      <button onClick={addOptionRow} className="text-xs text-orange-600 text-left">
        + Add option
      </button>
      <div className="flex justify-end gap-2 mt-1">
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

export function AddOnsEditor({ itemId }: { itemId: string }) {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newDraft, setNewDraft] = useState(emptyGroupDraft);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState(emptyGroupDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/restaurant/menu/${itemId}/modifier-groups`);
    if (res.ok) {
      setGroups((await res.json()).groups);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not load add-ons.");
      setGroups([]);
    }
  }, [itemId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  function cleanPayload(d: typeof emptyGroupDraft) {
    return {
      name: d.name,
      minSelect: d.minSelect,
      maxSelect: d.maxSelect,
      options: d.options.filter((o) => o.name.trim().length > 0),
    };
  }

  async function saveNew() {
    const payload = cleanPayload(newDraft);
    if (!payload.name) {
      setError("Give the group a name (e.g. \"Choice of protein\").");
      return;
    }
    if (payload.options.length === 0) {
      setError("Add at least one option.");
      return;
    }
    setError(null);
    setSaving(true);
    const res = await fetch(`/api/restaurant/menu/${itemId}/modifier-groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not save this group.");
      setSaving(false);
      return;
    }
    setNewDraft(emptyGroupDraft);
    setAddingNew(false);
    await refresh();
    setSaving(false);
  }

  function startEdit(group: Group) {
    setError(null);
    setEditingGroupId(group.id);
    setEditDraft({
      name: group.name,
      minSelect: group.minSelect,
      maxSelect: group.maxSelect,
      options: group.options.map((o) => ({ name: o.name, priceDeltaCents: o.priceDeltaCents })),
    });
  }

  async function saveEdit(groupId: string) {
    const payload = cleanPayload(editDraft);
    if (!payload.name) {
      setError("Give the group a name (e.g. \"Choice of protein\").");
      return;
    }
    if (payload.options.length === 0) {
      setError("Add at least one option.");
      return;
    }
    setError(null);
    setSaving(true);
    const res = await fetch(`/api/restaurant/modifier-groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not save changes.");
      setSaving(false);
      return;
    }
    setEditingGroupId(null);
    await refresh();
    setSaving(false);
  }

  async function removeGroup(groupId: string) {
    if (!confirm("Remove this add-on group?")) return;
    const res = await fetch(`/api/restaurant/modifier-groups/${groupId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not remove this group.");
      return;
    }
    await refresh();
  }

  if (!groups) return <p className="text-xs text-stone-400 px-3 pb-3">Loading add-ons…</p>;

  return (
    <div className="border-t border-stone-200 bg-stone-50 p-3 flex flex-col gap-2">
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-2 py-1.5">
          {error}
        </p>
      )}
      {groups.map((group) =>
        editingGroupId === group.id ? (
          <GroupForm
            key={group.id}
            draft={editDraft}
            onChange={setEditDraft}
            onSave={() => saveEdit(group.id)}
            onCancel={() => setEditingGroupId(null)}
            saving={saving}
          />
        ) : (
          <div key={group.id} className="bg-white border border-stone-200 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-sm font-medium">
                {group.name}{" "}
                <span className="text-xs text-stone-400 font-normal">
                  ({group.minSelect}-{group.maxSelect})
                </span>
              </p>
              <div className="flex gap-2">
                <button onClick={() => startEdit(group)} className="text-xs border border-stone-300 rounded-xl px-2 py-1">
                  Edit
                </button>
                <button
                  onClick={() => removeGroup(group.id)}
                  className="text-xs text-red-600 border border-red-200 rounded-xl px-2 py-1"
                >
                  Remove
                </button>
              </div>
            </div>
            <p className="text-xs text-stone-500">
              {group.options
                .map((o) => `${o.name}${o.priceDeltaCents ? ` (+${formatMoney(o.priceDeltaCents)})` : ""}`)
                .join(" · ")}
            </p>
          </div>
        )
      )}

      {addingNew ? (
        <GroupForm
          draft={newDraft}
          onChange={setNewDraft}
          onSave={saveNew}
          onCancel={() => {
            setAddingNew(false);
            setNewDraft(emptyGroupDraft);
          }}
          saving={saving}
        />
      ) : (
        <button onClick={() => { setError(null); setAddingNew(true); }} className="text-xs text-orange-600 text-left">
          + Add a group (e.g. size, spice level, extras)
        </button>
      )}
    </div>
  );
}
