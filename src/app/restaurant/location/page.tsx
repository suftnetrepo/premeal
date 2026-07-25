"use client";

import { useEffect, useState, useCallback } from "react";
import { kmToMiles, milesToKm } from "@/lib/geo";
import { AddressAutocomplete } from "@/app/components/address-autocomplete";
import { ProfileImageUpload } from "./profile-image-upload";
import { Settings } from "lucide-react";

export default function RestaurantSettingsPage() {
  const [address, setAddress] = useState("");
  const [radius, setRadius] = useState("5");
  const [deliveryFee, setDeliveryFee] = useState("3.00");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
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
      if (typeof data.deliveryFeeCents === "number") setDeliveryFee((data.deliveryFeeCents / 100).toFixed(2));
      setImageUrl(data.imageUrl ?? null);
      setDescription(data.description ?? "");
      setPhone(data.phone ?? "");
      setContactEmail(data.contactEmail ?? "");
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
      body: JSON.stringify({
        address,
        deliveryRadiusKm: milesToKm(Number(radius)),
        deliveryFeeCents: Math.round(Number(deliveryFee) * 100),
        description: description.trim() || null,
        phone: phone.trim() || null,
        contactEmail: contactEmail.trim() || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not save settings");
      setSaving(false);
      return;
    }
    setSavedAddress(data.address);
    setMessage("Saved.");
    setSaving(false);
  }

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-10 w-full">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
          <Settings size={16} strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-black tracking-tight text-stone-900">Restaurant settings</h1>
      </div>
      <p className="text-sm text-stone-500 mb-8">
        Your photo, location, delivery radius, and the contact details customers see on your order page.
      </p>

      <ProfileImageUpload key={imageUrl ?? "loading"} initialUrl={imageUrl} onUploaded={setImageUrl} />

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

        <label className="text-xs text-stone-500">
          Delivery fee (£)
          <input
            type="number"
            min={0}
            max={20}
            step={0.5}
            value={deliveryFee}
            onChange={(e) => setDeliveryFee(e.target.value)}
            className="mt-1 w-32 border border-stone-200 rounded-xl p-2.5 text-sm"
          />
          <span className="block mt-1 text-[11px] text-stone-400">
            What you charge customers for delivery — goes to you, same as before. £0 is a valid choice if
            you&apos;d rather offer free delivery yourself.
          </span>
        </label>

        {savedAddress && (
          <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
            Currently saved: {savedAddress}
          </p>
        )}

        <div className="border-t border-stone-100 mt-3 pt-5">
          <p className="text-sm font-medium text-stone-900 mb-1">Customer-facing details</p>
          <p className="text-xs text-stone-500 mb-3">
            Shown on your order page, next to checkout — so a customer can reach you directly if they
            need to (a dietary question, a delivery instruction, anything before or after ordering).
          </p>
        </div>

        <label className="text-xs text-stone-500">
          About / description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="A couple of sentences about your food, your kitchen, what makes you, you."
            className="mt-1 w-full border border-stone-200 rounded-xl p-2.5 text-sm resize-none"
          />
        </label>

        <label className="text-xs text-stone-500">
          Contact phone
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 07700 900000"
            className="mt-1 w-full border border-stone-200 rounded-xl p-2.5 text-sm"
          />
        </label>

        <label className="text-xs text-stone-500">
          Contact email
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="e.g. hello@yourrestaurant.com"
            className="mt-1 w-full border border-stone-200 rounded-xl p-2.5 text-sm"
          />
          <span className="block mt-1 text-[11px] text-stone-400">
            Optional — separate from your login email. Leave blank if you&apos;d rather customers only
            reach you by phone.
          </span>
        </label>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
        )}
        {message && <p className="text-xs text-stone-500">{message}</p>}

        <button
          onClick={save}
          disabled={saving || !address}
          className="bg-orange-600 disabled:bg-stone-300 text-white rounded-xl px-4 py-2.5 text-sm self-start"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </main>
  );
}
