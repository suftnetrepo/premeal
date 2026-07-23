import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatMoney, formatDate } from "@/lib/format";
import { DELIVERY_FEE_CENTS } from "@/lib/capacity";
import { OrderForm } from "./order-form";
import { StarDisplay } from "@/app/components/stars";

export const dynamic = "force-dynamic"; // capacity must always be fresh, never cached

export default async function RestaurantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: {
      menuItems: {
        where: { isAvailable: true },
        include: {
          modifierGroups: {
            orderBy: { sortOrder: "asc" },
            include: { options: { where: { isAvailable: true } } },
          },
        },
      },
      menuCategories: { orderBy: { sortOrder: "asc" } },
      deliverySlots: {
        where: { date: { gte: new Date(new Date().toDateString()) } },
        orderBy: [{ date: "asc" }, { windowStart: "asc" }],
      },
    },
  });

  if (!restaurant || restaurant.approvalStatus !== "APPROVED" || !restaurant.signupFeePaidAt) notFound();

  const reviews = await prisma.review.findMany({
    where: { restaurantId: id },
    include: { customer: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const slots = restaurant.deliverySlots.map((slot) => {
    const remaining = slot.capacity - slot.bookedCount;
    const isPastCutoff = slot.cutoffAt < new Date();
    const status: "available" | "limited" | "full" =
      isPastCutoff || remaining <= 0 ? "full" : remaining <= 5 ? "limited" : "available";
    return { ...slot, remaining, status };
  });

  return (
    <main className="w-full">
      {/* Hero banner — the restaurant's own uploaded photo if they have one
          (see /restaurant/location), otherwise a quiet icon placeholder.
          Constrained to the same width as the nav/content below rather
          than bleeding edge-to-edge — deliberately not the Just Eat
          pattern. No separate "logo" badge overlaid on top either: this
          app only has one image field per restaurant, not a distinct logo
          asset, so it isn't faked here. */}
      <div className="mx-auto max-w-7xl px-4 pt-6">
        <div className="relative w-full h-56 sm:h-72 bg-orange-50 rounded-3xl overflow-hidden">
          {restaurant.imageUrl ? (
            <Image src={restaurant.imageUrl} alt={restaurant.name} fill sizes="(max-width: 1280px) 100vw, 1280px" className="object-cover" priority />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl">🍽️</div>
          )}
          <Link
            href="/"
            className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/90 backdrop-blur flex items-center justify-center text-stone-700 hover:bg-white transition-colors"
            aria-label="Back to all restaurants"
          >
            <ArrowLeft size={18} strokeWidth={2} />
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4">
        <div className="mt-6 mb-8 max-w-2xl">
          <h1 className="text-3xl font-black tracking-tight text-stone-900">{restaurant.name}</h1>
          {restaurant.averageRating !== null && (
            <div className="flex items-center gap-1.5 mt-2">
              <StarDisplay rating={restaurant.averageRating} />
              <span className="text-sm text-stone-600">
                {restaurant.averageRating.toFixed(1)} ({restaurant.reviewCount} review
                {restaurant.reviewCount === 1 ? "" : "s"})
              </span>
            </div>
          )}
          {/* Real fee structure only: a flat delivery fee and this
              restaurant's actual minimum order — no fabricated service fee
              or small-order fee, since neither exists in this app's
              pricing model. */}
          <p className="text-stone-500 text-sm mt-2">
            {restaurant.cuisine} · Min {formatMoney(restaurant.minOrderCents)} · Delivery {formatMoney(DELIVERY_FEE_CENTS)}
          </p>
          {restaurant.description && (
            <p className="text-stone-500 text-sm mt-1">{restaurant.description}</p>
          )}
        </div>

        <OrderForm
          restaurantId={restaurant.id}
          categories={restaurant.menuCategories.map((c) => ({ id: c.id, name: c.name }))}
          menuItems={restaurant.menuItems.map((m) => ({
            id: m.id,
            name: m.name,
            description: m.description,
            imageUrl: m.imageUrl,
            priceCents: m.priceCents,
            categoryId: m.categoryId,
            modifierGroups: m.modifierGroups.map((g) => ({
              id: g.id,
              name: g.name,
              minSelect: g.minSelect,
              maxSelect: g.maxSelect,
              options: g.options.map((o) => ({
                id: o.id,
                name: o.name,
                priceDeltaCents: o.priceDeltaCents,
              })),
            })),
          }))}
          slots={slots.map((s) => ({
            id: s.id,
            date: s.date.toISOString(),
            windowStart: s.windowStart,
            windowEnd: s.windowEnd,
            remaining: s.remaining,
            status: s.status,
          }))}
        />

        {reviews.length > 0 && (
          <section className="mt-12 pt-8 border-t border-stone-200 pb-16">
            <h2 className="text-sm font-semibold text-stone-900 mb-4">
              Reviews {restaurant.reviewCount > reviews.length && `(showing ${reviews.length} most recent)`}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {reviews.map((r) => (
                <div key={r.id} className="border border-stone-200 rounded-xl p-4 bg-white">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-stone-900">{r.customer.name}</p>
                    <StarDisplay rating={r.rating} />
                  </div>
                  <p className="text-xs text-stone-400 mb-1">{formatDate(r.createdAt)}</p>
                  {r.comment && <p className="text-sm text-stone-600">{r.comment}</p>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
