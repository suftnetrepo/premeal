"use client";

import { useEffect, useState, useCallback } from "react";
import { formatMoney, formatDate } from "@/lib/format";

type Order = {
  id: string;
  status: string;
  totalCents: number;
  confirmationDeadline: string;
  deliveryAddress: string;
  customer: { name: string; email: string };
  slot: { date: string; windowStart: string; windowEnd: string };
  items: {
    nameSnapshot: string;
    quantity: number;
    notes?: string | null;
    modifiers: { groupName: string; optionName: string; priceDeltaCents: number }[];
  }[];
};

function minutesLeft(deadline: string): number {
  return Math.max(0, Math.round((new Date(deadline).getTime() - Date.now()) / 60_000));
}

export function DashboardClient({ restaurantId }: { restaurantId: string }) {
  const [pending, setPending] = useState<Order[]>([]);
  const [awaitingPayment, setAwaitingPayment] = useState<Order[]>([]);
  const [confirmed, setConfirmed] = useState<Order[]>([]);
  const [outForDelivery, setOutForDelivery] = useState<Order[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    const [pendingRes, awaitingRes, confirmedRes, outRes] = await Promise.all([
      fetch(`/api/orders?restaurantId=${restaurantId}&status=PENDING_CONFIRMATION`),
      fetch(`/api/orders?restaurantId=${restaurantId}&status=PAYMENT_ACTION_REQUIRED`),
      fetch(`/api/orders?restaurantId=${restaurantId}&status=CONFIRMED`),
      fetch(`/api/orders?restaurantId=${restaurantId}&status=OUT_FOR_DELIVERY`),
    ]);
    if (pendingRes.ok) setPending((await pendingRes.json()).orders);
    if (awaitingRes.ok) setAwaitingPayment((await awaitingRes.json()).orders);
    if (confirmedRes.ok) setConfirmed((await confirmedRes.json()).orders);
    if (outRes.ok) setOutForDelivery((await outRes.json()).orders);
  }, [restaurantId]);

  useEffect(() => {
    // Intentional: kick off the first fetch immediately, then poll.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function act(orderId: string, action: string) {
    setBusyId(orderId);
    const res = await fetch(`/api/orders/${orderId}/${action}`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Something went wrong");
    }
    await refresh();
    setBusyId(null);
  }

  async function submitCancel(orderId: string) {
    if (!cancelReason.trim()) return;
    setCancelSubmitting(true);
    setCancelError(null);
    const res = await fetch(`/api/orders/${orderId}/restaurant-cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: cancelReason }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setCancelError(typeof data.error === "string" ? data.error : "Could not cancel this order");
      setCancelSubmitting(false);
      return;
    }
    setCancellingId(null);
    setCancelReason("");
    setCancelSubmitting(false);
    await refresh();
  }

  return (
    <>
      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-stone-500">Needs a response</h2>
          <span className="text-xs text-stone-400">{pending.length} pending</span>
        </div>
        <div className="flex flex-col gap-3">
          {pending.map((order) => {
            const mins = minutesLeft(order.confirmationDeadline);
            return (
              <div key={order.id} className="border border-stone-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-sm">{order.customer.name}</p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      mins <= 5 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {mins}:00 left
                  </span>
                </div>
                <p className="text-xs text-stone-500 mb-2">
                  Delivery {formatDate(order.slot.date)} · {order.slot.windowStart}–
                  {order.slot.windowEnd}
                </p>
                <div className="text-sm mb-3">
                  {order.items.map((item, i) => (
                    <div key={i}>
                      <p>
                        {item.nameSnapshot} ×{item.quantity}
                        {item.notes ? ` — ${item.notes}` : ""}
                      </p>
                      {item.modifiers.length > 0 && (
                        <p className="text-xs text-stone-500 ml-3">
                          {item.modifiers.map((m) => m.optionName).join(", ")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{formatMoney(order.totalCents)}</p>
                  <div className="flex gap-2">
                    <button
                      disabled={busyId === order.id}
                      onClick={() => act(order.id, "decline")}
                      className="text-sm border border-stone-300 rounded-xl px-3 py-1.5"
                    >
                      Decline
                    </button>
                    <button
                      disabled={busyId === order.id}
                      onClick={() => act(order.id, "confirm")}
                      className="text-sm bg-orange-600 text-white rounded-xl px-3 py-1.5"
                    >
                      Accept
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {pending.length === 0 && (
            <p className="text-sm text-stone-400">No orders waiting on you right now.</p>
          )}
        </div>
      </section>

      {awaitingPayment.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-medium text-stone-500 mb-3">Waiting on customer payment verification</h2>
          <div className="flex flex-col gap-2">
            {awaitingPayment.map((order) => (
              <div key={order.id} className="border border-stone-200 rounded-xl p-3">
                <p className="text-sm font-medium">{order.customer.name}</p>
                <p className="text-xs text-stone-500">
                  You&apos;ve accepted this order — their bank needs them to confirm the charge before it&apos;s
                  final. Nothing for you to do yet.
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-10">
        <h2 className="text-sm font-medium text-stone-500 mb-3">Confirmed — ready to dispatch</h2>
        <div className="flex flex-col gap-2">
          {confirmed.map((order) => (
            <div key={order.id} className="border border-stone-200 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{order.customer.name}</p>
                  <p className="text-xs text-stone-500">
                    {formatDate(order.slot.date)} · {order.slot.windowStart}–{order.slot.windowEnd}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm">{formatMoney(order.totalCents)}</p>
                  <button
                    disabled={busyId === order.id}
                    onClick={() => act(order.id, "out-for-delivery")}
                    className="text-xs bg-orange-600 text-white rounded-xl px-3 py-1.5"
                  >
                    Mark out for delivery
                  </button>
                  {cancellingId !== order.id && (
                    <button
                      onClick={() => {
                        setCancellingId(order.id);
                        setCancelError(null);
                      }}
                      className="text-xs text-red-600 border border-red-200 rounded-xl px-3 py-1.5"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
              {cancellingId === order.id && (
                <div className="mt-3 pt-3 border-t border-stone-100 flex flex-col gap-2">
                  <p className="text-xs text-stone-500">
                    This refunds the customer in full and can&apos;t be undone. What&apos;s the reason?
                  </p>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="e.g. Out of an ingredient, unexpected closure…"
                    className="border border-stone-200 rounded-xl p-2 text-sm resize-none"
                    rows={2}
                  />
                  {cancelError && <p className="text-xs text-red-600">{cancelError}</p>}
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setCancellingId(null);
                        setCancelReason("");
                        setCancelError(null);
                      }}
                      className="text-xs border border-stone-300 rounded-xl px-3 py-1.5"
                    >
                      Never mind
                    </button>
                    <button
                      onClick={() => submitCancel(order.id)}
                      disabled={cancelSubmitting || !cancelReason.trim()}
                      className="text-xs bg-red-600 disabled:bg-stone-300 text-white rounded-xl px-3 py-1.5"
                    >
                      {cancelSubmitting ? "Cancelling…" : "Cancel & refund"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {confirmed.length === 0 && (
            <p className="text-sm text-stone-400">Nothing confirmed yet.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-stone-500 mb-3">Out for delivery</h2>
        <div className="flex flex-col gap-2">
          {outForDelivery.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between border border-stone-200 rounded-xl p-3"
            >
              <div>
                <p className="text-sm font-medium">{order.customer.name}</p>
                <p className="text-xs text-stone-500">{order.deliveryAddress}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm">{formatMoney(order.totalCents)}</p>
                <button
                  disabled={busyId === order.id}
                  onClick={() => act(order.id, "delivered")}
                  className="text-xs border border-stone-300 rounded-xl px-3 py-1.5"
                >
                  Mark delivered
                </button>
              </div>
            </div>
          ))}
          {outForDelivery.length === 0 && (
            <p className="text-sm text-stone-400">Nothing out for delivery right now.</p>
          )}
        </div>
      </section>
    </>
  );
}
