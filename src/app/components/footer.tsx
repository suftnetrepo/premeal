import Link from "next/link";
import { ShieldCheck, Clock3, Wallet } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-stone-200 bg-stone-50 mt-16">
      {/* Real value props only — no fake "80,000+ places" or loyalty-stamp
          claims Pre-Meal doesn't actually have. This section stands in for
          the "Download the app" banner on the Just Eat reference, which
          isn't buildable honestly here — there's no native app to link to,
          and using App Store/Google Play badges without one would misuse
          those trademarks, not just stretch the truth. */}
      <div className="mx-auto max-w-7xl px-4 py-12 grid grid-cols-1 sm:grid-cols-3 gap-8">
        <div className="flex items-start gap-3">
          <Clock3 size={20} className="text-orange-600 shrink-0 mt-0.5" strokeWidth={1.75} />
          <div>
            <p className="font-semibold text-stone-900 text-sm mb-0.5">Scheduled, not rushed</p>
            <p className="text-sm text-stone-500">Restaurants cook for the slot you booked, not a rush order.</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <ShieldCheck size={20} className="text-orange-600 shrink-0 mt-0.5" strokeWidth={1.75} />
          <div>
            <p className="font-semibold text-stone-900 text-sm mb-0.5">Real reviews only</p>
            <p className="text-sm text-stone-500">You can only review an order you actually received.</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Wallet size={20} className="text-orange-600 shrink-0 mt-0.5" strokeWidth={1.75} />
          <div>
            <p className="font-semibold text-stone-900 text-sm mb-0.5">Fair fees</p>
            <p className="text-sm text-stone-500">Restaurants keep 100% of the delivery fee they charge.</p>
          </div>
        </div>
      </div>

      <div className="border-t border-stone-200">
        <div className="mx-auto max-w-7xl px-4 py-10 flex flex-col sm:flex-row sm:items-start justify-between gap-8">
          <div>
            <p className="font-semibold text-stone-900">🍽️ Pre-Meal</p>
            <p className="text-sm text-stone-500 mt-1 max-w-xs">Order today, eat exactly when you planned to.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-8 sm:gap-16">
            <div>
              <p className="text-xs font-semibold text-stone-400 tracking-wide mb-3">PRE-MEAL</p>
              <ul className="flex flex-col gap-2 text-sm text-stone-600">
                <li><Link href="/#how-it-works" className="hover:text-orange-600">How it works</Link></li>
                <li><Link href="/about" className="hover:text-orange-600">About</Link></li>
                <li><Link href="/signup" className="hover:text-orange-600">Sign up your restaurant</Link></li>
                <li><Link href="/login" className="hover:text-orange-600">Log in</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-stone-400 tracking-wide mb-3">LEGAL</p>
              <ul className="flex flex-col gap-2 text-sm text-stone-600">
                <li><Link href="/terms" className="hover:text-orange-600">Terms of Service</Link></li>
                <li><Link href="/privacy" className="hover:text-orange-600">Privacy Policy</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-8">
          <p className="text-xs text-stone-400">© {new Date().getFullYear()} Pre-Meal.</p>
        </div>
      </div>
    </footer>
  );
}
