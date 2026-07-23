"use client";

import { useEffect, useState, useCallback } from "react";
import { kmToMiles, milesToKm } from "@/lib/geo";
import { AddressAutocomplete } from "@/app/components/address-autocomplete";
import { ProfileImageUpload } from "./profile-image-upload";
import { MapPin } from "lucide-react";

export default function LocationPage() {
  const [address, setAddress] = useState("");
  const [radius, setRadius] = useState("5");
  const [savedAddress, setSavedAddress] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/restaurant/location");
    if (res.ok) {
      const data = await res.json();
      if (data.address) {
        setSavedAddress(data.address);
        setAddress(data.address);
      }
      if (data.deliveryRadiusKm) setRadius(kmToMiles(data.deliveryRadiusKm).toFixed(1));
      setImageUrl(data.imageUrl ?? null);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/restaurant/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, deliveryRadiusKm: milesToKm(Number(radius)) }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not save location");
      setSaving(false);
      return;
    }
    setSavedAddress(data.address);
    setMessage("Saved — customers searching nearby can now find you.");
    setSaving(false);
  }

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-10 w-full">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
          <MapPin size={16} strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-black tracking-tight text-stone-900">Location & delivery radius</h1>
      </div>
      <p className="text-sm text-stone-500 mb-8">
        Since you deliver yourself, this is how far you&apos;re willing to drive — not a marketplace-wide setting.
      </p>

      <ProfileImageUpload initialUrl={imageUrl} onUploaded={setImageUrl} />

      <div className="flex flex-col gap-3 max-w-md">
        <label className="text-xs text-stone-500">
          Restaurant address
          <div className="mt-1">
            <AddressAutocomplete
              value={address}
              onChange={setAddress}
              placeholder="e.g. 14 High Street, Derby, DE1 1AA"
              className="w-full border border-stone-200 rounded-xl p-2.5 text-sm"
            />
          </div>
        </label>

        <label className="text-xs text-stone-500">
          Delivery radius (miles)
          <input
            type="number"
            min={0.5}
            step={0.5}
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            className="mt-1 w-32 border border-stone-200 rounded-xl p-2.5 text-sm"
          />
        </label>

        {savedAddress && (
          <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
            Currently saved: {savedAddress}
          </p>
        )}
        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
        )}
        {message && <p className="text-xs text-stone-500">{message}</p>}

        <button
          onClick={save}
          disabled={saving || !address}
          className="bg-orange-600 disabled:bg-stone-300 text-white rounded-xl px-4 py-2.5 text-sm self-start"
        >
          {saving ? "Saving…" : "Save location"}
        </button>
      </div>
    </main>
  );
}
