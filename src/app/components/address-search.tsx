"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AddressAutocomplete } from "./address-autocomplete";

export function AddressSearch({ currentAddress }: { currentAddress?: string }) {
  const router = useRouter();
  const [address, setAddress] = useState(currentAddress ?? "");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function goToResults(lat: number, lng: number, formattedAddress: string) {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng), address: formattedAddress });
    router.push(`/?${params.toString()}`);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;
    setSearching(true);
    setError(null);

    // Fallback path — the customer typed a full address and hit Search
    // without picking a suggestion from the dropdown.
    const res = await fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not find that address");
      setSearching(false);
      return;
    }

    goToResults(data.latitude, data.longitude, data.formattedAddress);
    setSearching(false);
  }

  return (
    <form onSubmit={handleSearch}>
      <div className="flex gap-2">
        <div className="flex-1">
          <AddressAutocomplete
            value={address}
            onChange={setAddress}
            onSelect={(s) => goToResults(s.latitude, s.longitude, s.formattedAddress)}
            placeholder="Full address"
            className="w-full border border-gray-200 rounded-lg p-3 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={searching}
          className="bg-orange-600 disabled:bg-gray-300 text-white rounded-lg px-6 text-sm font-medium"
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </form>
  );
}
