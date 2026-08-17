import Link from "next/link";
import Image from "next/image";
import type { SVGProps } from "react";
import { ShieldCheck, Clock3, Wallet } from "lucide-react";

// lucide-react (this app's only icon set) deliberately doesn't ship brand
// logos, so these are small inline glyphs used nowhere else. Kept minimal
// on purpose — see the "coming soon" note below on why they're not real
// links yet.
function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0 1.837c-3.146 0-3.507.012-4.744.069-2.505.114-3.674 1.301-3.788 3.788-.057 1.237-.068 1.598-.068 4.744 0 3.146.011 3.507.068 4.744.114 2.484 1.28 3.674 3.788 3.788 1.237.057 1.596.069 4.744.069 3.147 0 3.508-.012 4.744-.069 2.503-.114 3.675-1.3 3.788-3.788.058-1.237.069-1.598.069-4.744 0-3.146-.011-3.507-.069-4.744-.113-2.484-1.28-3.674-3.788-3.788-1.236-.057-1.597-.069-4.744-.069zm0 3.771a4.229 4.229 0 1 1 0 8.458 4.229 4.229 0 0 1 0-8.458zm0 1.838a2.392 2.392 0 1 0 0 4.783 2.392 2.392 0 0 0 0-4.783zm4.406-3.373a.988.988 0 1 1 0 1.977.988.988 0 0 1 0-1.977z" />
    </svg>
  );
}
function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
    </svg>
  );
}
function TwitterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
function TikTokIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M16.6 5.82c-.86-.94-1.35-2.16-1.35-3.5h-3.13v13.44a2.59 2.59 0 0 1-4.6 1.62 2.59 2.59 0 0 1 2.02-4.2c.28 0 .55.04.8.12V9.99a5.75 5.75 0 0 0-.8-.06A5.75 5.75 0 1 0 15.5 15.5V9.4a8.3 8.3 0 0 0 4.83 1.55V7.83a4.85 4.85 0 0 1-3.73-2.01z" />
    </svg>
  );
}

const SOCIAL_LINKS = [
  { label: "Instagram", Icon: InstagramIcon },
  { label: "Facebook", Icon: FacebookIcon },
  { label: "Twitter", Icon: TwitterIcon },
  { label: "TikTok", Icon: TikTokIcon },
];

export function Footer() {
  return (
    <footer className="border-t border-stone-200 bg-stone-50 mt-16">
      {/* Real value props only — no fake "80,000+ places" or loyalty-stamp
          claims Pre-Meal doesn't actually have. This section stands in for
          the "Download the app" banner on the Just Eat reference — the
          actual App Store/Google Play badges live further down instead
          (see "GET THE APP" below), shown honestly as not-yet-linked
          rather than faked here. */}
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
            <p className="font-semibold text-stone-900 flex items-center gap-1.5">
              <Image src="/logo.svg" alt="" width={18} height={18} /> Pre-Meal
            </p>
            <p className="text-sm text-stone-500 mt-1 max-w-xs">Order today, eat exactly when you planned to.</p>

            {/* No real Pre-Meal social accounts exist yet — same "coming
                soon" treatment as the App Store/Google Play badges below:
                shown, not clickable, no placeholder/fake destination. */}
            <div className="flex gap-2 mt-4">
              {SOCIAL_LINKS.map(({ label, Icon }) => (
                <span
                  key={label}
                  title={`${label} — coming soon`}
                  className="w-8 h-8 rounded-full bg-stone-900 text-white flex items-center justify-center opacity-90 cursor-not-allowed"
                >
                  <Icon width={15} height={15} />
                  <span className="sr-only">{label} — coming soon</span>
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-8 sm:gap-16">
            <div>
              <p className="text-xs font-semibold text-stone-400 tracking-wide mb-3">PRE-MEAL</p>
              <ul className="flex flex-col gap-2 text-sm text-stone-600">
                <li><Link href="/how-it-works" className="hover:text-orange-600">How it works</Link></li>
                <li><Link href="/about" className="hover:text-orange-600">About</Link></li>
                <li><Link href="/food-safety" className="hover:text-orange-600">Food safety</Link></li>
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
            <div>
              <p className="text-xs font-semibold text-stone-400 tracking-wide mb-3">GET THE APP</p>
              {/* Same real artwork, same not-yet-linked treatment as the
                  homepage's own app preview section (see
                  homepage-landing.tsx) — not publicly listed on either
                  store yet, so no real href until there's a real
                  destination to send someone to. */}
              <div className="flex flex-col gap-2">
                <span className="cursor-not-allowed opacity-90">
                  <Image src="/apple-appstore-logo.png" alt="Download on the App Store — coming soon" width={135} height={45} className="h-9 w-auto" />
                </span>
                <span className="cursor-not-allowed opacity-90">
                  <Image src="/google_play_logo.png" alt="Get it on Google Play — coming soon" width={152} height={45} className="h-9 w-auto" />
                </span>
              </div>
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
