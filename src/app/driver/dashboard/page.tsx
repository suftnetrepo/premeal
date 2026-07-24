"use client";

import { useEffect, useState, useCallback } from "react";
import { Truck, MapPin } from "lucide-react";
import { formatMoney, formatDate } from "@/lib/format";

type PendingRequest = {
  id: string;
  restaurant: { id: string; name: string; cuisine: string };
  invitedAt: string;
};

type Delivery = {
  id: string;
  status: string;
  totalCents: number;
  deliveryAddress: string;
  restaurant: { id: string; name: string; address: string | null };
  slot: { date: string; windowStart: string; windowEnd: string };
  items: { id: string; nameSnapshot: string; quantity: number }[];
};

const statusLabels: Record<string, string> = {
  CONFIRMED: "Ready for pickup",
  PREPARING: "Being prepared",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
};

export default function DriverDashboardPage() {
  const [requests, setRequests] = useState<PendingRequest[] | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [reqRes, delRes] = await Promise.all([
      fetch("/api/driver/requests"),
      fetch("/api/driver/deliveries"),
    ]);
    const reqData = await reqRes.json();
    const delData = await delRes.json();
    setRequests(reqData.requests ?? []);
    setDeliveries(delData.orders ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function respond(id: string, accept: boolean) {
    setBusyId(id);
    await fetch(`/api/driver/requests/${id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accept }),
    });
    setBusyId(null);
    load();
  }

  async function advanceStatus(orderId: string, currentStatus: string) {
    setBusyId(orderId);
    setError(null);
    const endpoint = currentStatus === "CONFIRMED" || currentStatus === "PREPARING" ? "out-for-delivery" : "delivered";
    const res = await fetch(`/api/orders/${orderId}/${endpoint}`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not update this delivery");
    }
    setBusyId(null);
    load();
  }

  return (
    <main className="mx-auto max-w-2xl px-4 sm:px-6 py-10 w-full">
      <div className="flex items-center gap-2 mb-6">
        <span className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
          <Truck size={16} strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-black tracking-tight text-stone-900">My deliveries</h1>
      </div>

      {requests !== null && requests.length > 0 && (
        <div className="mb-8">
          <p className="text-sm font-semibold text-stone-900 mb-2">Pending requests</p>
          <div className="flex flex-col gap-2">
            {requests.map((r) => (
              <div key={r.id} className="border border-amber-200 bg-amber-50 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{r.restaurant.name}</p>
                  <p className="text-xs text-stone-500">{r.restaurant.cuisine} · invited {formatDate(r.invitedAt)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => respond(r.id, true)}
                    disabled={busyId === r.id}
                    className="text-xs bg-orange-600 text-white rounded-lg px-3 py-1.5"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => respond(r.id, false)}
                    disabled={busyId === r.id}
                    className="text-xs border border-stone-300 rounded-lg px-3 py-1.5"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="flex flex-col gap-3">
        {deliveries === null && <p className="text-sm text-stone-400">Loading…</p>}
        {deliveries?.map((d) => (
          <div key={d.id} className="border border-stone-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="font-medium text-sm">{d.restaurant.name}</p>
              <p className="text-sm font-medium">{formatMoney(d.totalCents)}</p>
            </div>
            <p className="text-xs text-stone-500 mb-2">
              {formatDate(d.slot.date)} · {d.slot.windowStart}–{d.slot.windowEnd} · {statusLabels[d.status] ?? d.status}
            </p>
            <p className="text-xs text-stone-500 flex items-start gap-1 mb-3">
              <MapPin size={13} strokeWidth={1.75} className="shrink-0 mt-0.5" />
              {d.deliveryAddress}
            </p>
            <p className="text-xs text-stone-400 mb-3">
              {d.items.map((i) => `${i.nameSnapshot} ×${i.quantity}`).join(" · ")}
            </p>
            {(d.status === "CONFIRMED" || d.status === "PREPARING" || d.status === "OUT_FOR_DELIVERY") && (
              <button
                onClick={() => advanceStatus(d.id, d.status)}
                disabled={busyId === d.id}
                className="text-xs bg-orange-600 disabled:bg-stone-300 text-white rounded-lg px-3 py-1.5"
              >
                {busyId === d.id
                  ? "Updating…"
                  : d.status === "OUT_FOR_DELIVERY"
                    ? "Mark delivered"
                    : "Mark out for delivery"}
              </button>
            )}
          </div>
        ))}
        {deliveries?.length === 0 && <p className="text-sm text-stone-500">No deliveries assigned to you right now.</p>}
      </div>
    </main>
  );
}
