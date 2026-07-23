"use client";

import { useEffect, useState } from "react";
import { AddressAutocomplete } from "@/app/components/address-autocomplete";

type SavedAddress = { id: string; label: string | null; address: string; isDefault: boolean };

export function AddressPicker({ onChange }: { onChange: (address: string) => void }) {
  const [saved, setSaved] = useState<SavedAddress[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const [newAddress, setNewAddress] = useState("");
  const [saveForLater, setSaveForLater] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [savedThisSession, setSavedThisSession] = useState(false);

  useEffect(() => {
    fetch("/api/addresses")
      .then((res) => res.json())
      .then((data: { addresses?: SavedAddress[] }) => {
        const addresses = data.addresses ?? [];
        setSaved(addresses);
        const defaultAddr = addresses.find((a) => a.isDefault);
        if (defaultAddr) {
          setSelectedId(defaultAddr.id);
          onChange(defaultAddr.address);
        } else {
          setSelectedId("new");
        }
      });
    // Only run once on mount — onChange is a stable setter from the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectSaved(addr: SavedAddress) {
    setSelectedId(addr.id);
    onChange(addr.address);
  }

  function selectNew() {
    setSelectedId("new");
    onChange(newAddress);
  }

  function handleNewAddressChange(value: string) {
    setNewAddress(value);
    onChange(value);
    setSavedThisSession(false);
  }

  // Saves as soon as they finish typing (on blur), rather than deferring
  // to order submission — simpler than threading a save step through the
  // parent's submit flow, and harmless if they end up not placing the
  // order (worst case: an extra saved address).
  async function handleBlur() {
    if (!saveForLater || !newAddress.trim() || savedThisSession) return;
    setSavedThisSession(true);
    await fetch("/api/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: newAddress.trim(), label: newLabel.trim() || undefined }),
    });
  }

  if (saved === null) {
    return <p className="text-sm text-gray-400">Loading your addresses…</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {saved.map((addr) => (
        <label
          key={addr.id}
          className={`flex items-start gap-2 border rounded-lg p-3 cursor-pointer ${
            selectedId === addr.id ? "border-orange-500 ring-1 ring-orange-500" : "border-gray-200"
          }`}
        >
          <input
            type="radio"
            name="delivery-address"
            checked={selectedId === addr.id}
            onChange={() => selectSaved(addr)}
            className="mt-0.5"
          />
          <span className="text-sm">
            {addr.label && <span className="font-medium">{addr.label} — </span>}
            {addr.address}
            {addr.isDefault && <span className="text-xs text-orange-600 ml-1">(default)</span>}
          </span>
        </label>
      ))}

      <label
        className={`flex items-start gap-2 border rounded-lg p-3 cursor-pointer ${
          selectedId === "new" ? "border-orange-500 ring-1 ring-orange-500" : "border-gray-200"
        }`}
      >
        <input
          type="radio"
          name="delivery-address"
          checked={selectedId === "new"}
          onChange={selectNew}
          className="mt-0.5"
        />
        <span className="text-sm">Use a different address</span>
      </label>

      {selectedId === "new" && (
        <div className="pl-6 flex flex-col gap-2">
          <AddressAutocomplete
            value={newAddress}
            onChange={handleNewAddressChange}
            onBlur={handleBlur}
            placeholder="Delivery address"
            className="w-full border border-gray-200 rounded-lg p-2.5 text-sm"
          />
          <label className="flex items-center gap-2 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={saveForLater}
              onChange={(e) => setSaveForLater(e.target.checked)}
            />
            Save this address for next time
          </label>
          {saveForLater && (
            <input
              placeholder="Label (optional) — e.g. Home, Work"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onBlur={handleBlur}
              className="border border-gray-200 rounded-lg p-2 text-sm"
            />
          )}
        </div>
      )}
    </div>
  );
}
