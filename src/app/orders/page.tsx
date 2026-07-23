import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const statusStyles: Record<string, string> = {
  PENDING_CONFIRMATION: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  OUT_FOR_DELIVERY: "bg-blue-100 text-blue-700",
  DELIVERED: "bg-green-100 text-green-700",
  DECLINED: "bg-red-100 text-red-700",
  EXPIRED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-600",
};

const statusLabels: Record<string, string> = {
  PENDING_CONFIRMATION: "Awaiting confirmation",
  CONFIRMED: "Confirmed",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  DECLINED: "Declined",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

export default async function OrderHistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const orders = await prisma.order.findMany({
    where: { customerId: user.id },
    include: { items: true, restaurant: true, slot: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 w-full">
      <h1 className="text-2xl font-semibold mb-1">Your orders</h1>
      <p className="text-sm text-gray-500 mb-8">Everything you&apos;ve ordered through Pre-Meal.</p>

      <div className="flex flex-col gap-3">
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/orders/${order.id}`}
            className="block border border-gray-200 rounded-xl p-4 hover:border-orange-300 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="font-medium text-sm">{order.restaurant.name}</p>
              <span className={`text-xs px-2 py-0.5 rounded ${statusStyles[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                {statusLabels[order.status] ?? order.status}
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              {formatDate(order.slot.date)} · {order.slot.windowStart}–{order.slot.windowEnd} · ordered{" "}
              {formatDate(order.createdAt)}
            </p>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 truncate pr-4">
                {order.items.map((i) => `${i.nameSnapshot} ×${i.quantity}`).join(" · ")}
              </p>
              <p className="text-sm font-medium shrink-0">{formatMoney(order.totalCents)}</p>
            </div>
          </Link>
        ))}
        {orders.length === 0 && (
          <p className="text-sm text-gray-500">
            No orders yet — <Link href="/" className="text-orange-600">browse restaurants</Link> to get started.
          </p>
        )}
      </div>
    </main>
  );
}
