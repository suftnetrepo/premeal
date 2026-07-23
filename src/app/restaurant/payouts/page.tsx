"use client";

import { useEffect, useState, useCallback } from "react";
import { Wallet } from "lucide-react";

export default function PayoutsPage() {
  const [status, setStatus] = useState<{ connected: boolean; onboardingComplete: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/restaurant/payouts");
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not load payout status");
      return;
    }
    setStatus(data);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function startOnboarding() {
    setStarting(true);
    setError(null);
    const res = await fetch("/api/restaurant/payouts/onboard", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not start payout setup");
      setStarting(false);
      return;
    }
    window.location.href = data.url;
  }

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-10 w-full">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
          <Wallet size={16} strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-black tracking-tight text-stone-900">Payouts</h1>
      </div>
      <p className="text-sm text-stone-500 mb-8">
        You can take orders without this set up, but you won&apos;t actually get paid until it&apos;s done.
        Payouts fire automatically after each order is delivered — see the timeline on any confirmed order.
      </p>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-4">{error}</p>
      )}

      {!status ? (
        <p className="text-sm text-stone-400">Loading…</p>
      ) : status.onboardingComplete ? (
        <div className="border border-green-200 bg-green-50 rounded-xl p-4">
          <p className="text-sm text-green-800 font-medium">✅ Payouts are set up</p>
          <p className="text-xs text-green-700 mt-1">
            You&apos;ll be paid automatically after each delivered order&apos;s dispute window closes.
          </p>
        </div>
      ) : (
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
          <p className="text-sm text-amber-800 font-medium mb-3">
            {status.connected ? "Almost there — finish setting up your payout details" : "Payouts aren't set up yet"}
          </p>
          <button
            onClick={startOnboarding}
            disabled={starting}
            className="bg-orange-600 disabled:bg-stone-300 text-white rounded-xl px-4 py-2.5 text-sm"
          >
            {starting ? "Redirecting…" : status.connected ? "Finish setup" : "Set up payouts"}
          </button>
        </div>
      )}
    </main>
  );
}
