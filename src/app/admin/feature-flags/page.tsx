"use client";

import { useEffect, useState, useCallback } from "react";
import { SlidersHorizontal } from "lucide-react";

type Flag = { id: string; key: string; description: string | null; enabled: boolean };

export default function AdminFeatureFlagsPage() {
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/feature-flags");
    if (res.ok) setFlags((await res.json()).flags);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function toggle(flag: Flag) {
    await fetch(`/api/admin/feature-flags/${flag.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !flag.enabled }),
    });
    await refresh();
  }

  async function create() {
    if (!key.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/feature-flags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: key.trim(), description: description.trim() || undefined, enabled: false }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not create flag");
      setSaving(false);
      return;
    }
    setKey("");
    setDescription("");
    setCreating(false);
    setSaving(false);
    await refresh();
  }

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-10 w-full">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
          <SlidersHorizontal size={16} strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-black tracking-tight text-stone-900">Feature flags</h1>
      </div>
      <p className="text-sm text-stone-500 mb-8">
        Turn optional features on or off without a code change. A feature with no flag row here defaults to
        enabled.
      </p>

      <div className="flex flex-col gap-2 mb-8">
        {flags === null && <p className="text-sm text-stone-400">Loading…</p>}
        {flags?.map((flag) => (
          <div key={flag.id} className="flex items-center justify-between border border-stone-200 rounded-xl p-3">
            <div>
              <p className="text-sm font-medium">{flag.key}</p>
              {flag.description && <p className="text-xs text-stone-500 mt-0.5">{flag.description}</p>}
            </div>
            <button
              onClick={() => toggle(flag)}
              className={`text-xs px-3 py-1.5 rounded-full border ${
                flag.enabled ? "bg-green-100 text-green-700 border-green-200" : "bg-stone-100 text-stone-500 border-stone-200"
              }`}
            >
              {flag.enabled ? "Enabled" : "Disabled"}
            </button>
          </div>
        ))}
        {flags?.length === 0 && (
          <p className="text-sm text-stone-400">
            No flags configured yet — everything defaults to enabled until you add one.
          </p>
        )}
      </div>

      {creating ? (
        <div className="border border-orange-200 bg-orange-50/40 rounded-xl p-4 flex flex-col gap-2 max-w-md">
          <input
            placeholder="Key (e.g. subscriptions)"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="border border-stone-200 rounded-xl p-2 text-sm"
          />
          <input
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border border-stone-200 rounded-xl p-2 text-sm"
          />
          <p className="text-xs text-stone-500">New flags start disabled — flip it on above once created.</p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreating(false)} className="text-xs border border-stone-300 rounded-xl px-3 py-1.5">
              Cancel
            </button>
            <button
              onClick={create}
              disabled={saving}
              className="text-xs bg-orange-600 disabled:bg-stone-300 text-white rounded-xl px-3 py-1.5"
            >
              Create flag
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setCreating(true)} className="text-sm text-orange-600">
          + New flag
        </button>
      )}
    </main>
  );
}
