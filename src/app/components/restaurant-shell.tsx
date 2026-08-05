import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { RestaurantSidebarNav } from "./restaurant-sidebar-nav";
import { EmailVerificationBanner } from "./email-verification-banner";
import type { User } from "@prisma/client";

export async function RestaurantShell({ user, children }: { user: User; children: React.ReactNode }) {
  const restaurant = await prisma.restaurant.findFirst({ where: { ownerId: user.id } });

  const isLive =
    restaurant !== null &&
    restaurant.approvalStatus === "APPROVED" &&
    Boolean(restaurant.signupFeePaidAt);

  return (
    <div className="min-h-full flex flex-col">
      <RestaurantSidebarNav />

      {/* pl matches the sidebar's width on desktop; pb matches its height
          on mobile, where it becomes a fixed bottom bar instead. */}
      <div className="flex-1 flex flex-col sm:pl-16 pb-16 sm:pb-0">
        <header className="border-b border-stone-200 bg-white">
          <div className="px-4 sm:px-6 h-14 flex items-center justify-between">
            {/* h-full (not the parent's items-center default sizing) so the
                tappable area is the whole 56px-tall header slot, not just
                the 24px the logo glyph + text happen to render at. */}
            <Link href="/restaurant/dashboard" className="h-full font-bold text-stone-900 flex items-center gap-1.5">
              <Image src="/logo.svg" alt="" width={22} height={22} /> Pre-Meal
            </Link>
            <div className="flex items-center gap-3">
              {restaurant && (
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    isLive ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {restaurant.name} · {isLive ? "Live" : "Not live"}
                </span>
              )}
              <span className="text-sm text-stone-400 hidden sm:inline">{user.name}</span>
            </div>
          </div>
        </header>

        {!user.emailVerifiedAt && <EmailVerificationBanner email={user.email} />}

        <div className="flex-1 flex flex-col">{children}</div>
      </div>
    </div>
  );
}
