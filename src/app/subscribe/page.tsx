"use client";

import { useEffect, useState, useCallback } from "react";

type Subscription = {
  status: "ACTIVE" | "PAST_DUE" | "CANCELED" | "INCOMPLETE";
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
} | null;

export default function SubscribePage() {
  const [subscription, setSubscription] = useState<Subscription | undefined>(undefined);
  const [available, setAvailable] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justReturnedFromCheckout, setJustReturnedFromCheckout] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/subscribe/status");
    if (res.ok) {
      const data = await res.json();
      setSubscription(data.subscription);
      setAvailable(data.available);
    }
  }, []);

  useEffect(() => {
    // Plain client-side read rather than useSearchParams() — avoids the
    // Suspense-boundary requirement that hook imposes for what's only a
    // one-off "welcome back from Checkout" banner.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJustReturnedFromCheckout(window.location.search.includes("success=1"));
    refresh();
  }, [refresh]);

  async function subscribe() {
    setStarting(true);
    setError(null);
    const res = await fetch("/api/subscribe/checkout-session", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not start checkout");
      setStarting(false);
      return;
    }
    window.location.href = data.url;
  }

  async function manage() {
    setStarting(true);
    setError(null);
    const res = await fetch("/api/subscribe/portal-session", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not open billing portal");
      setStarting(false);
      return;
    }
    window.location.href = data.url;
  }

  const isActive = subscription?.status === "ACTIVE";

  return (
    <main className="mx-auto max-w-md px-4 py-10 w-full">
      <h1 className="text-2xl font-semibold mb-1">Pre-Meal+</h1>
      <p className="text-sm text-gray-500 mb-6">Free delivery and 5% off every order.</p>

      {justReturnedFromCheckout && !isActive && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">
          Payment received — this can take a few seconds to activate.
        </p>
      )}

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {subscription === undefined ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : isActive ? (
        <div className="border border-green-200 bg-green-50 rounded-xl p-4">
          <p className="text-sm text-green-800 font-medium mb-1">✅ You&apos;re subscribed</p>
          {subscription?.cancelAtPeriodEnd ? (
            <p className="text-xs text-green-700">
              Ending{" "}
              {subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd).toLocaleDateString()} —
              you&apos;ll keep your benefits until then.
            </p>
          ) : (
            subscription?.currentPeriodEnd && (
              <p className="text-xs text-green-700">
                Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            )
          )}
          <button
            onClick={manage}
            disabled={starting}
            className="mt-3 text-sm border border-green-300 text-green-800 rounded-lg px-4 py-2"
          >
            {starting ? "Opening…" : "Manage subscription"}
          </button>
        </div>
      ) : !available ? (
        <div className="border border-gray-200 bg-gray-50 rounded-xl p-4">
          <p className="text-sm text-gray-600">Pre-Meal+ isn&apos;t available to new subscribers right now.</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl p-4">
          <ul className="text-sm text-gray-600 flex flex-col gap-1.5 mb-4">
            <li>✓ Free delivery on every order</li>
            <li>✓ 5% off your food subtotal</li>
            <li>✓ Cancel any time</li>
          </ul>
          <p className="text-2xl font-semibold mb-3">
            £9.99<span className="text-sm font-normal text-gray-500">/month</span>
          </p>
          <button
            onClick={subscribe}
            disabled={starting}
            className="w-full bg-orange-600 disabled:bg-gray-300 text-white rounded-lg py-2.5 text-sm font-medium"
          >
            {starting ? "Redirecting…" : "Subscribe"}
          </button>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Doesn&apos;t stack with promo codes — whichever gives you the better deal on a given order applies.
          </p>
        </div>
      )}
    </main>
  );
}
