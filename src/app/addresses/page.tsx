"use client";

import { useEffect, useState, useCallback } from "react";
import { AddressAutocomplete } from "@/app/components/address-autocomplete";

type Address = { id: string; label: string | null; address: string; isDefault: boolean };

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/addresses");
    if (res.ok) setAddresses((await res.json()).addresses);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function addAddress() {
    if (!newAddress.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: newAddress.trim(), label: newLabel.trim() || undefined }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not save address");
      setSaving(false);
      return;
    }
    setNewLabel("");
    setNewAddress("");
    setAdding(false);
    setSaving(false);
    await refresh();
  }

  async function makeDefault(id: string) {
    await fetch(`/api/addresses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    await refresh();
  }

  async function remove(id: string) {
    if (!confirm("Remove this address?")) return;
    await fetch(`/api/addresses/${id}`, { method: "DELETE" });
    await refresh();
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 w-full">
      <h1 className="text-2xl font-semibold mb-1">Delivery addresses</h1>
      <p className="text-sm text-gray-500 mb-8">
        Save addresses you use often. Your default is pre-selected at checkout.
      </p>

      {!addresses ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <div className="flex flex-col gap-2 mb-6">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={`border rounded-lg p-3 flex items-center justify-between ${
                addr.isDefault ? "border-orange-300 bg-orange-50/40" : "border-gray-200"
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {addr.label && <p className="text-sm font-medium">{addr.label}</p>}
                  {addr.isDefault && (
                    <span className="text-[11px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 truncate">{addr.address}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                {!addr.isDefault && (
                  <button
                    onClick={() => makeDefault(addr.id)}
                    className="text-xs border border-gray-300 rounded-lg px-2 py-1"
                  >
                    Make default
                  </button>
                )}
                <button
                  onClick={() => remove(addr.id)}
                  className="text-xs text-red-600 border border-red-200 rounded-lg px-2 py-1"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {addresses.length === 0 && (
            <p className="text-sm text-gray-400">No saved addresses yet.</p>
          )}
        </div>
      )}

      {adding ? (
        <div className="border border-orange-200 bg-orange-50/40 rounded-lg p-3 flex flex-col gap-2">
          <input
            placeholder="Label (optional) — e.g. Home, Work"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="border border-gray-200 rounded-lg p-2 text-sm"
          />
          <AddressAutocomplete
            value={newAddress}
            onChange={setNewAddress}
            placeholder="Full address"
            className="w-full border border-gray-200 rounded-lg p-2 text-sm"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
              className="text-xs border border-gray-300 rounded-lg px-3 py-1.5"
            >
              Cancel
            </button>
            <button
              onClick={addAddress}
              disabled={saving}
              className="text-xs bg-orange-600 disabled:bg-gray-300 text-white rounded-lg px-3 py-1.5"
            >
              Save address
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="text-sm text-orange-600">
          + Add an address
        </button>
      )}
    </main>
  );
}
