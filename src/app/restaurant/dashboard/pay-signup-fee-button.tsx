"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";

export function PaySignupFeeButton({ feeCents }: { feeCents: number }) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setStarting(true);
    setError(null);
    const res = await fetch("/api/restaurant/signup-fee/checkout-session", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not start checkout");
      setStarting(false);
      return;
    }
    window.location.href = data.url;
  }

  return (
    <div>
      <button
        onClick={start}
        disabled={starting}
        className="bg-orange-600 disabled:bg-stone-300 text-white rounded-xl px-4 py-2 text-sm"
      >
        {starting ? "Redirecting…" : `Pay ${formatMoney(feeCents)} signup fee`}
      </button>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
