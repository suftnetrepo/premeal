import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { StarDisplay } from "@/app/components/stars";
import { Star } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RestaurantReviewsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "RESTAURANT_OWNER") redirect("/");

  const restaurant = await prisma.restaurant.findFirst({ where: { ownerId: user.id } });
  if (!restaurant) redirect("/restaurant/dashboard");

  const reviews = await prisma.review.findMany({
    where: { restaurantId: restaurant.id },
    include: { customer: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-10 w-full">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
          <Star size={16} strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-black tracking-tight text-stone-900">Reviews</h1>
      </div>
      {restaurant.averageRating !== null ? (
        <div className="flex items-center gap-2 mb-8">
          <StarDisplay rating={restaurant.averageRating} size="text-xl" />
          <p className="text-lg font-medium">{restaurant.averageRating.toFixed(1)}</p>
          <p className="text-sm text-stone-500">
            from {restaurant.reviewCount} review{restaurant.reviewCount === 1 ? "" : "s"}
          </p>
        </div>
      ) : (
        <p className="text-sm text-stone-500 mb-8">No reviews yet — they show up here once customers rate a delivered order.</p>
      )}

      <div className="flex flex-col gap-3">
        {reviews.map((r) => (
          <div key={r.id} className="border border-stone-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium">{r.customer.name}</p>
              <StarDisplay rating={r.rating} />
            </div>
            <p className="text-xs text-stone-400 mb-2">{formatDate(r.createdAt)}</p>
            {r.comment && <p className="text-sm text-stone-600">{r.comment}</p>}
          </div>
        ))}
      </div>
    </main>
  );
}
