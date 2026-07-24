"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Mail, MapPin, StickyNote, Printer, Download, ChefHat, Truck } from "lucide-react";
import { formatMoney, formatDate } from "@/lib/format";

type OrderItemModifier = { id: string; groupName: string; optionName: string; priceDeltaCents: number };
type OrderItem = {
  id: string;
  nameSnapshot: string;
  priceCents: number;
  quantity: number;
  modifiers: OrderItemModifier[];
};
type Order = {
  id: string;
  status: string;
  subtotalCents: number;
  deliveryFeeCents: number;
  discountCents: number;
  totalCents: number;
  deliveryAddress: string;
  notes: string | null;
  createdAt: Date;
  confirmedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  cancelledByRestaurant: boolean;
  restaurantCancelReason: string | null;
  disputedAt: Date | null;
  disputeReason: string | null;
  disputeResolution: string | null;
  customer: { name: string; email: string };
  slot: { date: Date; windowStart: string; windowEnd: string };
  items: OrderItem[];
  driver: { id: string; name: string } | null;
};

const statusStyles: Record<string, string> = {
  PENDING_CONFIRMATION: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  OUT_FOR_DELIVERY: "bg-blue-100 text-blue-700",
  DELIVERED: "bg-green-100 text-green-700",
  DECLINED: "bg-red-100 text-red-700",
  EXPIRED: "bg-red-100 text-red-700",
  CANCELLED: "bg-stone-100 text-stone-600",
};

const statusLabels: Record<string, string> = {
  PENDING_CONFIRMATION: "Awaiting response",
  CONFIRMED: "Confirmed",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  DECLINED: "Declined",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

// Only the timestamp that's actually relevant to the current status —
// showing every timestamp on every order is noise, not detail.
function relevantTimestamp(order: Order): { label: string; date: Date } | null {
  if (order.status === "DELIVERED" && order.deliveredAt) return { label: "Delivered", date: order.deliveredAt };
  if (order.status === "CANCELLED" && order.cancelledAt) return { label: "Cancelled", date: order.cancelledAt };
  if (order.confirmedAt) return { label: "Confirmed", date: order.confirmedAt };
  return null;
}

type PrepSummaryItem = {
  name: string;
  totalQty: number;
  // Only populated when this item's modifiers actually vary across the
  // filtered orders (e.g. some Large, some Regular) — a plain item with
  // no options never grows a pointless single-line breakdown repeating
  // its own total.
  breakdown: { label: string; qty: number }[];
};

// Grouped by item name + modifier combination, not just item name —
// "Lasagna (Large)" and "Lasagna (Regular)" are prepared differently, so
// collapsing them into one number would make the total actively
// misleading for kitchen prep, not just imprecise.
function computePrepSummary(orders: Order[]): PrepSummaryItem[] {
  const groups = new Map<string, { name: string; modifierLabel: string; qty: number }>();

  for (const order of orders) {
    for (const item of order.items) {
      const modifierLabel = item.modifiers.map((m) => m.optionName).sort().join(", ");
      const key = `${item.nameSnapshot}::${modifierLabel}`;
      const existing = groups.get(key);
      if (existing) {
        existing.qty += item.quantity;
      } else {
        groups.set(key, { name: item.nameSnapshot, modifierLabel, qty: item.quantity });
      }
    }
  }

  const byName = new Map<string, PrepSummaryItem>();
  for (const g of groups.values()) {
    let entry = byName.get(g.name);
    if (!entry) {
      entry = { name: g.name, totalQty: 0, breakdown: [] };
      byName.set(g.name, entry);
    }
    entry.totalQty += g.qty;
    if (g.modifierLabel) {
      entry.breakdown.push({ label: g.modifierLabel, qty: g.qty });
    }
  }

  // Highest-demand items first — the ones worth starting prep on first.
  return Array.from(byName.values()).sort((a, b) => b.totalQty - a.totalQty);
}

// Wraps in quotes and escapes internal quotes per the CSV spec — without
// this, a customer name with a comma or an address with a quote in it
// would silently corrupt the column alignment for every row after it.
function csvField(value: string | number): string {
  const str = String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

function exportOrdersToCsv(orders: Order[], restaurantName: string) {
  const headers = [
    "Order ID",
    "Customer name",
    "Customer email",
    "Status",
    "Ordered",
    "Delivery date",
    "Delivery window",
    "Delivery address",
    "Items",
    "Subtotal",
    "Delivery fee",
    "Discount",
    "Total",
  ];

  const rows = orders.map((order) => [
    csvField(order.id),
    csvField(order.customer.name),
    csvField(order.customer.email),
    csvField(statusLabels[order.status] ?? order.status),
    csvField(formatDate(order.createdAt)),
    csvField(formatDate(order.slot.date)),
    csvField(`${order.slot.windowStart}-${order.slot.windowEnd}`),
    csvField(order.deliveryAddress),
    csvField(order.items.map((i) => `${i.nameSnapshot} x${i.quantity}`).join("; ")),
    csvField((order.subtotalCents / 100).toFixed(2)),
    csvField((order.deliveryFeeCents / 100).toFixed(2)),
    csvField((order.discountCents / 100).toFixed(2)),
    csvField((order.totalCents / 100).toFixed(2)),
  ]);

  const csv = [headers.map(csvField).join(","), ...rows.map((r) => r.join(","))].join("\r\n");

  // A BOM so Excel (still the most common consumer of a CSV like this)
  // correctly detects UTF-8 instead of mangling anything non-ASCII in a
  // customer name or address.
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${restaurantName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function OrderHistoryList({
  orders,
  summaryOrders,
  restaurantName,
  activeDrivers,
}: {
  orders: Order[];
  summaryOrders: Order[];
  restaurantName: string;
  activeDrivers: { id: string; name: string }[];
}) {
  const [selected, setSelected] = useState<Order | null>(null);
  const router = useRouter();
  const [assigning, setAssigning] = useState(false);

  async function handleAssignDriver(orderId: string, driverId: string | null) {
    setAssigning(true);
    const res = await fetch(`/api/restaurant/orders/${orderId}/assign-driver`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId }),
    });
    if (res.ok) {
      const newDriver = driverId ? activeDrivers.find((d) => d.id === driverId) ?? null : null;
      setSelected((prev) => (prev && prev.id === orderId ? { ...prev, driver: newDriver } : prev));
      router.refresh();
    }
    setAssigning(false);
  }
  // Deliberately computed from summaryOrders (the entire filtered set),
  // not the paginated `orders` currently rendered as cards — see
  // SUMMARY_SAFETY_CAP in page.tsx for why these are two different
  // queries. A prep total or CSV export that silently only covered the
  // current page would be wrong the moment there's a second page.
  const prepSummary = computePrepSummary(summaryOrders);

  return (
    <>
      {prepSummary.length > 0 && (
        <div className="border border-stone-200 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <ChefHat size={16} className="text-orange-600" strokeWidth={1.75} />
            <p className="text-sm font-semibold text-stone-900">
              Prep summary <span className="font-normal text-stone-400">— {summaryOrders.length} order{summaryOrders.length === 1 ? "" : "s"} in this view</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {prepSummary.map((item) => (
              <div
                key={item.name}
                className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2"
                title={item.breakdown.map((b) => `${b.label}: ${b.qty}`).join(", ") || undefined}
              >
                <p className="text-sm text-stone-900">
                  <span className="font-semibold">{item.name}</span> ×{item.totalQty}
                </p>
                {item.breakdown.length > 1 && (
                  <p className="text-xs text-stone-500 mt-0.5">
                    {item.breakdown.map((b) => `${b.label}: ${b.qty}`).join(" · ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end mb-3">
        <button
          onClick={() => exportOrdersToCsv(summaryOrders, restaurantName)}
          disabled={summaryOrders.length === 0}
          className="flex items-center gap-1.5 text-xs border border-stone-200 rounded-full px-3 py-1.5 text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Download size={13} strokeWidth={1.75} />
          Export CSV ({summaryOrders.length})
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {orders.map((order) => {
          const previewItems = order.items.slice(0, 2);
          const extraCount = order.items.length - previewItems.length;
          return (
            <button
              key={order.id}
              onClick={() => setSelected(order)}
              className="text-left border border-stone-200 rounded-xl p-4 hover:border-orange-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium text-sm">{order.customer.name}</p>
                <span className={`text-xs px-2 py-0.5 rounded ${statusStyles[order.status] ?? "bg-stone-100 text-stone-600"}`}>
                  {statusLabels[order.status] ?? order.status}
                </span>
              </div>
              <p className="text-xs text-stone-500 mb-2">
                {formatDate(order.slot.date)} · {order.slot.windowStart}–{order.slot.windowEnd} · ordered{" "}
                {formatDate(order.createdAt)}
              </p>
              {/* Capped preview instead of one truncated horizontal line —
                  an order with many items no longer overflows or gets cut
                  off mid-word; "+N more" is a real, accurate count. */}
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-stone-500 truncate flex-1">
                  {previewItems.map((i) => `${i.nameSnapshot} ×${i.quantity}`).join(" · ")}
                  {extraCount > 0 && ` · +${extraCount} more`}
                </p>
                <p className="text-sm font-medium shrink-0">{formatMoney(order.totalCents)}</p>
              </div>
            </button>
          );
        })}
        {orders.length === 0 && <p className="text-sm text-stone-500">No orders in this view yet.</p>}
      </div>

      {/* Right-side drawer — full order detail without losing your place
          in the list behind it (a modal would cover it entirely). */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} aria-hidden="true" />
          <div className="relative bg-white w-full sm:max-w-md h-full overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-white border-b border-stone-100 p-5 flex items-center justify-between">
              <div>
                <p className="font-bold text-stone-900">{selected.customer.name}</p>
                <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded ${statusStyles[selected.status] ?? "bg-stone-100 text-stone-600"}`}>
                  {statusLabels[selected.status] ?? selected.status}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => window.print()}
                  aria-label="Print receipt"
                  title="Print receipt"
                  className="w-9 h-9 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-500 transition-colors"
                >
                  <Printer size={18} strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => setSelected(null)}
                  aria-label="Close"
                  className="w-9 h-9 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-500 transition-colors"
                >
                  <X size={18} strokeWidth={2} />
                </button>
              </div>
            </div>

            <div id="print-receipt" className="p-5 flex flex-col gap-5">
              {/* Restaurant name only needs to appear on the printed
                  version — on screen it's redundant, since you're
                  already looking at this restaurant's own order list. */}
              <p className="hidden print:block text-lg font-bold text-stone-900 -mb-2">{restaurantName}</p>

              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center gap-2 text-stone-600">
                  <Mail size={14} strokeWidth={1.75} className="shrink-0" />
                  {selected.customer.email}
                </div>
                <div className="flex items-start gap-2 text-stone-600">
                  <MapPin size={14} strokeWidth={1.75} className="shrink-0 mt-0.5" />
                  {selected.deliveryAddress}
                </div>
                {selected.notes && (
                  <div className="flex items-start gap-2 text-stone-600">
                    <StickyNote size={14} strokeWidth={1.75} className="shrink-0 mt-0.5" />
                    {selected.notes}
                  </div>
                )}
              </div>

              <div className="text-sm text-stone-500">
                {formatDate(selected.slot.date)} · {selected.slot.windowStart}–{selected.slot.windowEnd}
                <br />
                Ordered {formatDate(selected.createdAt)}
                {relevantTimestamp(selected) && (
                  <>
                    {" · "}
                    {relevantTimestamp(selected)!.label} {formatDate(relevantTimestamp(selected)!.date)}
                  </>
                )}
              </div>

              {(selected.cancelledByRestaurant && selected.restaurantCancelReason) && (
                <div className="text-sm bg-red-50 text-red-700 rounded-lg p-3">
                  Cancelled by restaurant: {selected.restaurantCancelReason}
                </div>
              )}
              {selected.disputedAt && (
                <div className="text-sm bg-amber-50 text-amber-800 rounded-lg p-3">
                  <p className="font-medium">Customer reported a problem</p>
                  {selected.disputeReason && <p className="mt-0.5">{selected.disputeReason}</p>}
                  {selected.disputeResolution && (
                    <p className="mt-0.5 text-amber-700">Resolution: {selected.disputeResolution}</p>
                  )}
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-stone-400 tracking-wide mb-2 flex items-center gap-1.5">
                  <Truck size={13} strokeWidth={1.75} />
                  DRIVER
                </p>
                <select
                  value={selected.driver?.id ?? ""}
                  disabled={assigning}
                  onChange={(e) => handleAssignDriver(selected.id, e.target.value || null)}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Unassigned</option>
                  {activeDrivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                {activeDrivers.length === 0 && (
                  <p className="text-xs text-stone-400 mt-1">
                    No active drivers yet — invite one from the Drivers page.
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-stone-400 tracking-wide mb-2">ITEMS</p>
                <div className="flex flex-col gap-3">
                  {selected.items.map((item) => (
                    <div key={item.id} className="text-sm">
                      <div className="flex justify-between">
                        <p className="font-medium text-stone-900">
                          {item.quantity}× {item.nameSnapshot}
                        </p>
                        <p className="text-stone-900">{formatMoney(item.priceCents * item.quantity)}</p>
                      </div>
                      {item.modifiers.length > 0 && (
                        <p className="text-xs text-stone-400 mt-0.5">
                          {item.modifiers.map((m) => m.optionName).join(", ")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-stone-100 pt-4 flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between text-stone-500">
                  <p>Subtotal</p>
                  <p>{formatMoney(selected.subtotalCents)}</p>
                </div>
                <div className="flex justify-between text-stone-500">
                  <p>Delivery</p>
                  <p>{formatMoney(selected.deliveryFeeCents)}</p>
                </div>
                {selected.discountCents > 0 && (
                  <div className="flex justify-between text-green-700">
                    <p>Discount</p>
                    <p>-{formatMoney(selected.discountCents)}</p>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-stone-900 text-base pt-1">
                  <p>Total</p>
                  <p>{formatMoney(selected.totalCents)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
