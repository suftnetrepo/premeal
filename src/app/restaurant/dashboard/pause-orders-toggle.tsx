"use client";

import { useState } from "react";

export function PauseOrdersToggle({ initialIsActive }: { initialIsActive: boolean }) {
  const [isActive, setIsActive] = useState(initialIsActive);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !isActive;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/restaurant/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not update your order status");
      setSaving(false);
      return;
    }
    setIsActive(data.isActive);
    setSaving(false);
  }

  return (
    <div
      className={`flex items-center justify-between rounded-2xl p-4 mb-6 border ${
        isActive ? "bg-white border-stone-200" : "bg-red-50 border-red-200"
      }`}
    >
      <div>
        <p className="text-sm font-semibold text-stone-900">
          {isActive ? "Accepting new orders" : "Not accepting new orders"}
        </p>
        <p className="text-xs text-stone-500 mt-0.5">
          {isActive
            ? "Customers can place orders with you right now."
            : "Pause this if you're closed, on holiday, or can't confirm orders for a while — customers won't be able to order until you turn it back on."}
        </p>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        role="switch"
        aria-checked={isActive}
        aria-label="Toggle accepting new orders"
        className={`w-12 h-7 rounded-full flex items-center px-1 transition-colors shrink-0 ml-4 disabled:opacity-60 ${
          isActive ? "bg-green-600 justify-end" : "bg-stone-300 justify-start"
        }`}
      >
        <span className="w-5 h-5 rounded-full bg-white block shadow-sm" />
      </button>
    </div>
  );
}
