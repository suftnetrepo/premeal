import Link from "next/link";
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
          <span className="text-orange-600">🍽️</span> Pre-Meal
        </Link>

        {user ? (
          <div className="flex items-center gap-5">
            {user.role === "CUSTOMER" && (
              <>
                <Link href="/orders" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
                  My orders
                </Link>
                <Link href="/addresses" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
                  Addresses
                </Link>
                {(subscriptionsEnabled || hasExistingSubscription) && (
                  <Link href="/subscribe" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
                    Pre-Meal+
                  </Link>
                )}
              </>
            )}
            <span className="text-sm text-stone-400">{user.name}</span>
            <LogoutButton />
          </div>
        ) : (
          <div className="flex items-center gap-6">
            <Link href="/#how-it-works" className="text-sm text-stone-600 hover:text-stone-900 transition-colors hidden sm:inline">
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
