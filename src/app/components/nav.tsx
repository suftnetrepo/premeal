import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth";
import { isFeatureEnabled, FEATURE_FLAGS } from "@/lib/feature-flags";
import { prisma } from "@/lib/db";
import { LogoutButton } from "./logout-button";
import { NavShell } from "./nav-shell";

export async function Nav() {
  const user = await getCurrentUser();
  const subscriptionsEnabled = await isFeatureEnabled(FEATURE_FLAGS.SUBSCRIPTIONS);
  // Even with new signups paused, an existing subscriber still needs a way
  // to reach the page and manage/cancel via the Stripe Billing Portal.
  const hasExistingSubscription =
    user?.role === "CUSTOMER" && !subscriptionsEnabled
      ? Boolean(await prisma.subscription.findUnique({ where: { userId: user.id } }))
      : false;

  return (
    <NavShell>
      <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
        <Link href="/" className="font-bold text-stone-900 flex items-center gap-1.5">
          <Image src="/logo.svg" alt="" width={22} height={22} /> Pre-Meal
        </Link>

        {user ? (
          // gap-3 sm:gap-5 + hidden-on-mobile name: with the full desktop
          // gap and the name always shown, a realistic (i.e. not "Demo
          // Customer"-short) name wrapped inside this fixed h-16 header and
          // visibly collided with the logo above it and the page content
          // below it — the exact "not responsive at all" symptom, just one
          // that only a long-enough name reproduces. Fixed the same way
          // restaurant-shell.tsx already handles its own header: the name
          // is decorative (not a page a customer needs to reach) so it's
          // the one hidden on mobile, not "My orders"/"Addresses" — those
          // stay reachable at every width. Pre-Meal+ is a promotional
          // upsell link (not account management a customer needs), so it
          // gets the same hidden-on-mobile treatment as the marketing
          // links below — same tradeoff, lower stakes than hiding a page
          // there'd be no other way to reach.
          <div className="flex items-center gap-3 sm:gap-5">
            {user.role === "CUSTOMER" && (
              <>
                <Link href="/orders" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
                  My orders
                </Link>
                <Link href="/addresses" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
                  Addresses
                </Link>
                {(subscriptionsEnabled || hasExistingSubscription) && (
                  <Link href="/subscribe" className="text-sm text-stone-500 hover:text-stone-900 transition-colors hidden sm:inline">
                    Pre-Meal+
                  </Link>
                )}
              </>
            )}
            <span className="text-sm text-stone-400 hidden sm:inline max-w-40 truncate">{user.name}</span>
            <LogoutButton />
          </div>
        ) : (
          <div className="flex items-center gap-6">
            <Link href="/how-it-works" className="text-sm text-stone-600 hover:text-stone-900 transition-colors hidden sm:inline">
              How it works
            </Link>
            <Link href="/signup" className="text-sm text-stone-600 hover:text-stone-900 transition-colors hidden sm:inline">
              For restaurants
            </Link>
            <Link href="/about" className="text-sm text-stone-600 hover:text-stone-900 transition-colors hidden sm:inline">
              About
            </Link>
            <Link href="/login" className="text-sm text-stone-600 hover:text-stone-900 transition-colors">
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium bg-orange-600 hover:bg-orange-700 transition-colors text-white rounded-full px-4 py-2"
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </NavShell>
  );
}
