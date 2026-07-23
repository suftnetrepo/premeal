"use client";

import { useEffect, useState, useCallback } from "react";
import { formatMoney, formatDate } from "@/lib/format";
import { Scale } from "lucide-react";

type DisputeOrder = {
  id: string;
  totalCents: number;
  disputeReason: string | null;
  disputedAt: string;
  disputeResolvedAt: string | null;
  disputeResolution: string | null;
  createdAt: string;
  customer: { name: string; email: string };
  restaurant: { name: string };
  items: { nameSnapshot: string; quantity: number }[];
};

export default function AdminDisputesPage() {
  const [showResolved, setShowResolved] = useState(false);
  const [orders, setOrders] = useState<DisputeOrder[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/admin/disputes?resolved=${showResolved}`);
    if (res.ok) setOrders((await res.json()).orders);
  }, [showResolved]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function resolve(orderId: string, resolution: "release_payout" | "refund") {
    setBusyId(orderId);
    setError(null);
    const res = await fetch(`/api/admin/orders/${orderId}/resolve-dispute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution, note: noteDrafts[orderId] || undefined }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not resolve dispute");
      setBusyId(null);
      return;
    }
    setBusyId(null);
    await refresh();
  }

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-10 w-full">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
          <Scale size={16} strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-black tracking-tight text-stone-900">Disputes</h1>
      </div>
      <p className="text-sm text-stone-500 mb-6">
        A customer reported a problem after delivery, which blocks the restaurant&apos;s payout until you decide.
      </p>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setShowResolved(false)}
          className={`text-xs px-3 py-1.5 rounded-full border ${
            !showResolved ? "bg-stone-900 text-white border-stone-900" : "border-stone-200 text-stone-600"
          }`}
        >
          Open
        </button>
        <button
          onClick={() => setShowResolved(true)}
          className={`text-xs px-3 py-1.5 rounded-full border ${
            showResolved ? "bg-stone-900 text-white border-stone-900" : "border-stone-200 text-stone-600"
          }`}
        >
          All (incl. resolved)
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="flex flex-col gap-3">
        {orders === null && <p className="text-sm text-stone-400">Loading…</p>}
        {orders?.map((order) => (
          <div key={order.id} className="border border-stone-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="font-medium text-sm">
                {order.customer.name} → {order.restaurant.name}
              </p>
              <p className="text-sm">{formatMoney(order.totalCents)}</p>
            </div>
            <p className="text-xs text-stone-500 mb-2">
              Ordered {formatDate(order.createdAt)} · reported {formatDate(order.disputedAt)}
            </p>
            <p className="text-sm mb-2">&quot;{order.disputeReason}&quot;</p>
            <p className="text-xs text-stone-500 mb-3">
              {order.items.map((i) => `${i.nameSnapshot} ×${i.quantity}`).join(" · ")}
            </p>

            {order.disputeResolvedAt ? (
              <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                Resolved: {order.disputeResolution}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <input
                  value={noteDrafts[order.id] ?? ""}
                  onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [order.id]: e.target.value }))}
                  placeholder="Note (optional, saved with the resolution)"
                  className="border border-stone-200 rounded-xl p-2 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => resolve(order.id, "release_payout")}
                    disabled={busyId === order.id}
                    className="text-xs bg-orange-600 disabled:bg-stone-300 text-white rounded-xl px-3 py-1.5"
                  >
                    Side with restaurant — release payout
                  </button>
                  <button
                    onClick={() => resolve(order.id, "refund")}
                    disabled={busyId === order.id}
                    className="text-xs bg-red-600 disabled:bg-stone-300 text-white rounded-xl px-3 py-1.5"
                  >
                    Side with customer — refund
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {orders?.length === 0 && <p className="text-sm text-stone-400">Nothing here.</p>}
      </div>
    </main>
  );
}
