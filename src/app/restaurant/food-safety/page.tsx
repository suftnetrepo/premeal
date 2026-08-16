import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FoodSafetyForm } from "./food-safety-form";

export default async function FoodSafetyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "RESTAURANT_OWNER") redirect("/");

  const restaurant = await prisma.restaurant.findFirst({ where: { ownerId: user.id } });
  if (!restaurant) redirect("/restaurant/dashboard");

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-10 w-full">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
          <ShieldCheck size={16} strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-black tracking-tight text-stone-900">Food safety compliance</h1>
      </div>
      <p className="text-sm text-stone-500 mb-8">
        Mandatory before we can approve your restaurant — a confirmation that you&apos;re registered with your
        local authority, plus the document itself.
      </p>

      <FoodSafetyForm
        initialDocumentUrl={restaurant.foodSafetyDocumentUrl}
        initialAcknowledgedAt={restaurant.foodSafetyAcknowledgedAt?.toISOString() ?? null}
      />
    </main>
  );
}
