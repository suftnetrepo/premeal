import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney, formatDate } from "@/lib/format";
import type { OrderStatus } from "@prisma/client";
import { ClipboardList } from "lucide-react";

export const dynamic = "force-dynamic";

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

const FILTERS: { label: string; value: OrderStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Awaiting response", value: "PENDING_CONFIRMATION" },
  { label: "Confirmed", value: "CONFIRMED" },
  { label: "Out for delivery", value: "OUT_FOR_DELIVERY" },
  { label: "Delivered", value: "DELIVERED" },
  { label: "Declined/expired", value: "DECLINED" },
];

export default async function RestaurantOrderHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "RESTAURANT_OWNER") redirect("/");

  const restaurant = await prisma.restaurant.findFirst({ where: { ownerId: user.id } });
  if (!restaurant) redirect("/restaurant/dashboard");

  const { status } = await searchParams;
  const activeFilter = status ?? "ALL";

  const statusWhere =
    activeFilter === "ALL"
      ? {}
      : activeFilter === "DECLINED"
        ? { status: { in: ["DECLINED", "EXPIRED"] as OrderStatus[] } }
        : { status: activeFilter as OrderStatus };

  const orders = await prisma.order.findMany({
    where: { restaurantId: restaurant.id, ...statusWhere },
    include: { items: true, customer: true, slot: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-10 w-full">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
          <ClipboardList size={16} strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-black tracking-tight text-stone-900">Order history</h1>
      </div>
      <p className="text-sm text-stone-500 mb-6">{restaurant.name} — all orders received.</p>

      <div className="flex gap-2 overflow-x-auto mb-6 pb-1">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "ALL" ? "/restaurant/orders" : `/restaurant/orders?status=${f.value}`}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full border ${
              activeFilter === f.value ? "bg-stone-900 text-white border-stone-900" : "border-stone-200 text-stone-600"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {orders.map((order) => (
          <div key={order.id} className="border border-stone-200 rounded-xl p-4">
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
            <div className="flex items-center justify-between">
              <p className="text-xs text-stone-500 truncate pr-4">
                {order.items.map((i) => `${i.nameSnapshot} ×${i.quantity}`).join(" · ")}
              </p>
              <p className="text-sm font-medium shrink-0">{formatMoney(order.totalCents)}</p>
            </div>
          </div>
        ))}
        {orders.length === 0 && <p className="text-sm text-stone-500">No orders in this view yet.</p>}
      </div>
    </main>
  );
}
