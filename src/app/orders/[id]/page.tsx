"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { formatMoney, formatDate } from "@/lib/format";
import { PaymentActionVerify } from "./payment-action-verify";
import { ReviewForm } from "./review-form";
import { StarDisplay } from "@/app/components/stars";

type OrderStatus =
  | "PENDING_CONFIRMATION"
  | "PAYMENT_ACTION_REQUIRED"
  | "CONFIRMED"
  | "DECLINED"
  | "EXPIRED"
  | "CANCELLED"
  | "PREPARING"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED";

type Order = {
  id: string;
  status: OrderStatus;
  totalCents: number;
  confirmationDeadline: string;
  payoutEligibleAt: string | null;
  disputedAt: string | null;
  refundedAt: string | null;
  review: { rating: number; comment: string | null } | null;
  cancelledByRestaurant: boolean;
  restaurantCancelReason: string | null;
  deliveryAddress: string;
  restaurant: { name: string };
  slot: { date: string; windowStart: string; windowEnd: string };
  items: {
    nameSnapshot: string;
    quantity: number;
    modifiers: { groupName: string; optionName: string; priceDeltaCents: number }[];
  }[];
};

function useCountdown(deadline: string) {
  const [remainingMs, setRemainingMs] = useState(() => new Date(deadline).getTime() - Date.now());
  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingMs(new Date(deadline).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline]);
  const clamped = Math.max(0, remainingMs);
  const minutes = Math.floor(clamped / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const statusCopy: Record<OrderStatus, { title: string; sub: string }> = {
  PENDING_CONFIRMATION: {
    title: "Waiting for restaurant to confirm",
    sub: "Nothing is charged until they say yes",
  },
  PAYMENT_ACTION_REQUIRED: {
    title: "Almost there — verify your payment",
    sub: "Your bank needs a quick confirmation to complete the charge",
  },
  CONFIRMED: { title: "Confirmed — you're all set", sub: "Your card has been charged" },
  DECLINED: { title: "Restaurant couldn't take this order", sub: "You have not been charged" },
  EXPIRED: { title: "No response in time", sub: "Automatically declined — you have not been charged" },
  CANCELLED: { title: "Order cancelled", sub: "" },
  PREPARING: { title: "Being prepared", sub: "" },
  OUT_FOR_DELIVERY: { title: "Out for delivery", sub: "" },
  DELIVERED: { title: "Delivered", sub: "Enjoy!" },
};

const REPORTABLE: OrderStatus[] = ["OUT_FOR_DELIVERY", "DELIVERED"];
const CANCELLABLE: OrderStatus[] = ["PENDING_CONFIRMATION", "PAYMENT_ACTION_REQUIRED", "CONFIRMED"];

export default function OrderStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const [orderId, setOrderId] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  useEffect(() => {
    params.then((p) => setOrderId(p.id));
  }, [params]);

  const refresh = useCallback(async () => {
    if (!orderId) return;
    const res = await fetch(`/api/orders/${orderId}`);
    if (res.ok) {
      const data = await res.json();
      setOrder(data.order);
    }
  }, [orderId]);

  useEffect(() => {
    // Intentional: kick off the first fetch immediately, then poll.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, [refresh]);

  const countdown = useCountdown(order?.confirmationDeadline ?? new Date().toISOString());

  async function submitReport() {
    if (!orderId || !reason.trim()) return;
    setSubmittingReport(true);
    setReportError(null);
    const res = await fetch(`/api/orders/${orderId}/report-problem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setReportError(typeof data.error === "string" ? data.error : "Could not report a problem");
      setSubmittingReport(false);
      return;
    }
    setReporting(false);
    setSubmittingReport(false);
    await refresh();
  }

  async function cancelOrderNow() {
    if (!orderId) return;
    setCancelling(true);
    setCancelError(null);
    const res = await fetch(`/api/orders/${orderId}/cancel`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setCancelError(typeof data.error === "string" ? data.error : "Could not cancel this order");
      setCancelling(false);
      return;
    }
    setConfirmingCancel(false);
    setCancelling(false);
    await refresh();
  }

  if (!order) {
    return (
      <main className="mx-auto max-w-md px-4 py-10 w-full">
        <p className="text-sm text-gray-500">Loading order…</p>
      </main>
    );
  }

  const copy =
    order.status === "CANCELLED" && order.cancelledByRestaurant
      ? { title: "The restaurant had to cancel this order", sub: "You've been refunded in full" }
      : statusCopy[order.status];
  const isPending = order.status === "PENDING_CONFIRMATION";
  const reportWindowOpen =
    !order.disputedAt &&
    REPORTABLE.includes(order.status) &&
    (!order.payoutEligibleAt || new Date(order.payoutEligibleAt) > new Date());

  return (
    <main className="mx-auto max-w-md px-4 py-10 w-full">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
        ← Back home
      </Link>

      <div className="text-center py-8">
        <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center text-3xl mx-auto mb-4">
          {isPending
            ? "⏳"
            : order.status === "PAYMENT_ACTION_REQUIRED"
              ? "🔐"
              : order.status === "CONFIRMED"
                ? "✅"
                : order.status === "DELIVERED"
                  ? "🎉"
                  : "🔔"}
        </div>
        <p className="font-medium">{order.restaurant.name}</p>
        <h1 className="text-lg font-semibold mt-1">{copy.title}</h1>
        {copy.sub && <p className="text-sm text-gray-500 mt-1">{copy.sub}</p>}
      </div>

      {isPending && (
        <div className="bg-gray-50 rounded-xl p-4 text-center mb-6">
          <p className="text-xs text-gray-500 mb-1">Time left to confirm</p>
          <p className="text-3xl font-semibold tabular-nums">{countdown}</p>
        </div>
      )}

      <div className="bg-gray-50 rounded-xl p-4 mb-6">
        <p className="text-xs text-gray-500 mb-2">
          Delivery — {formatDate(order.slot.date)}, {order.slot.windowStart}–{order.slot.windowEnd}
        </p>
        <div className="flex flex-col gap-1">
          {order.items.map((item, i) => (
            <div key={i} className="text-sm">
              <div className="flex justify-between">
                <span>
                  {item.nameSnapshot} ×{item.quantity}
                </span>
              </div>
              {item.modifiers.length > 0 && (
                <p className="text-xs text-gray-500">
                  {item.modifiers.map((m) => m.optionName).join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-sm font-medium border-t border-gray-200 mt-2 pt-2">
          <span>Total</span>
          <span>{formatMoney(order.totalCents)}</span>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center mb-6">
        Delivering to {order.deliveryAddress}
      </p>

      {order.status === "DELIVERED" && (
        <div className="mb-6">
          {order.review ? (
            <div className="border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-medium mb-1">Your review</p>
              <StarDisplay rating={order.review.rating} size="text-lg" />
              {order.review.comment && (
                <p className="text-sm text-gray-600 mt-2">{order.review.comment}</p>
              )}
            </div>
          ) : (
            <ReviewForm orderId={order.id} onSubmitted={refresh} />
          )}
        </div>
      )}

      {order.disputedAt && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <p className="text-sm text-amber-800">
            You reported a problem with this order. We&apos;ll follow up by email.
          </p>
        </div>
      )}

      {order.status === "PAYMENT_ACTION_REQUIRED" && (
        <div className="mb-6">
          <PaymentActionVerify orderId={order.id} onDone={refresh} />
        </div>
      )}

      {order.status === "CANCELLED" && order.refundedAt && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center mb-6">
          <p className="text-sm text-gray-600">You were refunded in full.</p>
          {order.cancelledByRestaurant && order.restaurantCancelReason && (
            <p className="text-xs text-gray-500 mt-1">
              Reason given: {order.restaurantCancelReason}
            </p>
          )}
        </div>
      )}

      {!order.disputedAt && reportWindowOpen && !reporting && (
        <button
          onClick={() => setReporting(true)}
          className="w-full text-sm border border-gray-300 rounded-lg py-2.5"
        >
          Report a problem with this order
        </button>
      )}

      {reporting && (
        <div className="border border-gray-200 rounded-xl p-4 flex flex-col gap-2">
          <p className="text-sm font-medium">What went wrong?</p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Order never arrived, missing items, wrong order…"
            className="border border-gray-200 rounded-lg p-2 text-sm resize-none"
            rows={3}
          />
          {reportError && <p className="text-xs text-red-600">{reportError}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setReporting(false)}
              className="text-xs border border-gray-300 rounded-lg px-3 py-1.5"
            >
              Cancel
            </button>
            <button
              onClick={submitReport}
              disabled={submittingReport || !reason.trim()}
              className="text-xs bg-orange-600 disabled:bg-gray-300 text-white rounded-lg px-3 py-1.5"
            >
              Submit
            </button>
          </div>
        </div>
      )}

      {CANCELLABLE.includes(order.status) && !confirmingCancel && (
        <button
          onClick={() => setConfirmingCancel(true)}
          className="w-full text-sm text-red-600 border border-red-200 rounded-lg py-2.5 mt-3"
        >
          Cancel this order
        </button>
      )}

      {confirmingCancel && (
        <div className="border border-red-200 rounded-xl p-4 mt-3">
          <p className="text-sm font-medium mb-1">Cancel this order?</p>
          <p className="text-xs text-gray-500 mb-3">
            {order.status === "CONFIRMED"
              ? "Your card has already been charged — cancelling now refunds you in full."
              : "You haven't been charged yet, so there's nothing to refund."}
          </p>
          {cancelError && <p className="text-xs text-red-600 mb-2">{cancelError}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setConfirmingCancel(false)}
              className="text-xs border border-gray-300 rounded-lg px-3 py-1.5"
            >
              Never mind
            </button>
            <button
              onClick={cancelOrderNow}
              disabled={cancelling}
              className="text-xs bg-red-600 disabled:bg-gray-300 text-white rounded-lg px-3 py-1.5"
            >
              {cancelling ? "Cancelling…" : "Yes, cancel"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
