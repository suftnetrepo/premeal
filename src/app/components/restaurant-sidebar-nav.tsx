"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Star,
  UtensilsCrossed,
  CalendarDays,
  MapPin,
  Wallet,
  Truck,
  LogOut,
} from "lucide-react";

const ITEMS = [
  { href: "/restaurant/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/restaurant/orders", label: "Orders", icon: ClipboardList },
  { href: "/restaurant/reviews", label: "Reviews", icon: Star },
  { href: "/restaurant/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/restaurant/deliveries", label: "Deliveries", icon: CalendarDays },
  { href: "/restaurant/drivers", label: "Drivers", icon: Truck },
  { href: "/restaurant/location", label: "Location", icon: MapPin },
  { href: "/restaurant/payouts", label: "Payouts", icon: Wallet },
];

export function RestaurantSidebarNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav
      className="fixed z-40 bg-white border-stone-200 flex
        bottom-0 inset-x-0 h-16 flex-row items-center border-t
        sm:inset-y-0 sm:left-0 sm:right-auto sm:top-0 sm:bottom-auto sm:h-full sm:w-16
        sm:flex-col sm:border-t-0 sm:border-r"
    >
      {/* Scrollable if there are more items than the viewport has room
          for — on desktop this is the difference between the logout
          button being merely at the bottom vs. pushed out of view
          entirely with no way to reach it on a shorter screen. */}
      <div
        className="flex items-center gap-1 overflow-x-auto px-2 flex-1 min-w-0
          sm:flex-col sm:items-center sm:gap-1 sm:pt-4 sm:px-0 sm:overflow-y-auto sm:overflow-x-visible sm:min-h-0"
      >
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              title={item.label}
              className="group relative flex items-center justify-center shrink-0 sm:mb-1"
            >
              <span
                className={`flex items-center justify-center w-11 h-11 rounded-xl transition-colors ${
                  active ? "bg-orange-600 text-white" : "text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                }`}
              >
                <item.icon size={20} strokeWidth={1.75} />
              </span>
              {/* Hover label — icon-only nav needs some way to say what each
                  icon means beyond the aria-label/title, both for sighted
                  users and to satisfy real accessibility, not just pass a
                  lint check. */}
              <span className="pointer-events-none absolute left-full ml-2 hidden sm:group-hover:block whitespace-nowrap bg-stone-900 text-white text-xs rounded-md px-2 py-1 z-50">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Pinned, not scrollable — always reachable regardless of how many
          nav items exist above or how short the viewport is. */}
      <button
        type="button"
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          router.push("/");
          router.refresh();
        }}
        aria-label="Log out"
        title="Log out"
        className="flex items-center justify-center w-11 h-11 rounded-xl text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors shrink-0 mr-2 sm:mr-0 sm:mb-4"
      >
        <LogOut size={20} strokeWidth={1.75} />
      </button>
    </nav>
  );
}
