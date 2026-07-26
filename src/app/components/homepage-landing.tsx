import Image from "next/image";
import {
  CheckCircle2,
  CalendarClock,
  ShieldCheck,
  Wallet,
  Smartphone,
  Star,
} from "lucide-react";
import { AddressSearch } from "./address-search";
import type { PlatformStats } from "@/lib/homepage-stats";

export function HomepageLanding({
  platformStats,
  hasAnyStats,
}: {
  platformStats: PlatformStats;
  hasAnyStats: boolean;
}) {
  return (
    <>
      {/* -----------------------------------------------------------------
          Hero — public/hero.jpg, a real uploaded photo (see the "Real
          hero photo, replacing the gradient placeholder" note in
          README.md).
      ----------------------------------------------------------------- */}
      <section className="bg-gradient-to-b from-orange-50/60 to-white border-b border-stone-100">
        <div className="mx-auto max-w-7xl grid md:grid-cols-2 gap-10 md:gap-8 px-4 py-10 md:py-14">
          <div className="flex flex-col justify-center">
            <p className="text-xs font-semibold tracking-widest text-orange-600 mb-4">
              SCHEDULE AHEAD · EAT ON TIME
            </p>
            <h1 className="text-[34px] sm:text-[42px] lg:text-[64px] font-black tracking-tight text-stone-900 leading-[1.05] mb-5">
              Fresh food.
              <br />
              Delivered exactly
              <br />
              <span className="text-orange-600">when you want it.</span>
            </h1>
            <p className="text-lg text-stone-600 mb-8 max-w-md">
              Pick a restaurant, choose your delivery day and time, and we&apos;ll confirm within
              30 minutes.
            </p>
            <div className="bg-white rounded-2xl border border-stone-200 p-3 shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
              <AddressSearch />
            </div>
          </div>

          <div className="relative flex items-center justify-center min-h-[360px] rounded-3xl overflow-hidden">
            <Image
              src="/hero.jpg"
              alt="A real spread of dishes cooked for scheduled delivery"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              priority
            />
            {/* Fades the photo's left edge into the section's cream
                background instead of a hard rectangular seam against
                the text column. */}
            <div className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-orange-50 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-black/0 to-black/0" />

            <div className="relative bg-white/90 backdrop-blur rounded-2xl shadow-xl p-6 w-72 -rotate-3 border border-white">
              <p className="text-[10px] font-semibold tracking-widest text-stone-400 mb-2">
                YOUR DELIVERY SLOT
              </p>
              <p className="text-xl font-bold text-stone-900 leading-tight">Fri 18:00–19:00</p>
              <p className="text-sm text-stone-500 mt-0.5">Sakura Sushi</p>
              <div className="border-t border-dashed border-stone-200 my-4" />
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-green-600" strokeWidth={2} />
                <p className="text-sm font-medium text-green-700">Confirmed in 12 min</p>
              </div>
            </div>
          </div>
        </div>

        {/* Value props — real claims only. */}
        <div id="how-it-works" className="mx-auto max-w-7xl px-4 pb-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { icon: CalendarClock, title: "Schedule, not rush", body: "Book your delivery slot days ahead." },
            { icon: ShieldCheck, title: "Real reviews only", body: "Reviews come from orders actually delivered." },
            { icon: CheckCircle2, title: "Confirmed fast", body: "Restaurants respond within 30 minutes." },
            { icon: Wallet, title: "Fair & transparent", body: "You pay exactly what the restaurant charges." },
          ].map((item) => (
            <div
              key={item.title}
              className="bg-white rounded-2xl border border-stone-200 p-5 flex items-start gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                <item.icon size={18} strokeWidth={1.75} />
              </div>
              <div>
                <p className="font-semibold text-stone-900 text-sm mb-0.5">{item.title}</p>
                <p className="text-sm text-stone-500">{item.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Real numbers only — each stat is computed live and simply
            omitted if the underlying count is zero. */}
        {hasAnyStats && (
          <div className="border-t border-stone-100 bg-white">
            <div className="mx-auto max-w-7xl px-4 py-8 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
              {platformStats.deliveredCount !== null && (
                <div>
                  <p className="text-3xl font-black text-stone-900">{platformStats.deliveredCount}+</p>
                  <p className="text-sm text-stone-500 mt-1">Scheduled deliveries</p>
                </div>
              )}
              {platformStats.confirmRatePercent !== null && (
                <div>
                  <p className="text-3xl font-black text-stone-900">{platformStats.confirmRatePercent}%</p>
                  <p className="text-sm text-stone-500 mt-1">Restaurants confirm within 30 minutes</p>
                </div>
              )}
              {platformStats.averageRating !== null && (
                <div>
                  <p className="text-3xl font-black text-stone-900 flex items-center justify-center gap-1.5">
                    {platformStats.averageRating.toFixed(1)}
                    <Star size={22} className="text-amber-500 fill-amber-500" />
                  </p>
                  <p className="text-sm text-stone-500 mt-1">Average customer rating</p>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* -----------------------------------------------------------------
          App preview — three real screens (scheduling, checkout,
          confirmation), built from this app's own UI language rather than
          photographed device mockups.
      ----------------------------------------------------------------- */}
      <section className="bg-stone-50 border-t border-stone-100">
        <div className="mx-auto max-w-7xl px-4 py-10 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mb-4">
              <Smartphone size={22} strokeWidth={1.75} />
            </div>
            <p className="text-2xl font-black text-stone-900 mb-2">The app is on its way</p>
            <p className="text-stone-600 mb-6 max-w-sm">
              Native iOS and Android apps are planned before launch — for now, order from your
              browser exactly the same way.
            </p>
            <div className="flex gap-2">
              <span className="text-xs text-stone-400 border border-stone-200 rounded-lg px-3 py-2 cursor-not-allowed bg-white">
                iOS — coming soon
              </span>
              <span className="text-xs text-stone-400 border border-stone-200 rounded-lg px-3 py-2 cursor-not-allowed bg-white">
                Android — coming soon
              </span>
            </div>
          </div>

          <div className="flex gap-4 justify-center overflow-x-auto no-scrollbar py-2">
            {[
              { label: "Scheduling", content: "slot" },
              { label: "Checkout", content: "checkout" },
              { label: "Confirmed", content: "confirmed" },
            ].map((screen) => (
              <div key={screen.label} className="shrink-0 w-32 rounded-2xl border-4 border-stone-900 bg-white overflow-hidden shadow-lg">
                <div className="h-4 bg-stone-900 flex items-center justify-center">
                  <div className="w-8 h-1.5 rounded-full bg-stone-700" />
                </div>
                <div className="p-2.5 h-48 flex flex-col">
                  {screen.content === "slot" && (
                    <>
                      <p className="text-[9px] font-semibold text-stone-400 mb-1.5">SELECT A TIME</p>
                      <div className="grid grid-cols-3 gap-1 mb-2">
                        {["16", "17", "18"].map((h) => (
                          <div key={h} className={`text-[8px] text-center rounded py-1 ${h === "18" ? "bg-orange-600 text-white" : "bg-stone-100 text-stone-500"}`}>
                            {h}:00
                          </div>
                        ))}
                      </div>
                      <div className="mt-auto bg-orange-600 rounded text-white text-[8px] text-center py-1.5">Continue</div>
                    </>
                  )}
                  {screen.content === "checkout" && (
                    <>
                      <p className="text-[9px] font-semibold text-stone-400 mb-1.5">YOUR ORDER</p>
                      <div className="flex flex-col gap-1 mb-2">
                        <div className="h-1.5 bg-stone-100 rounded w-full" />
                        <div className="h-1.5 bg-stone-100 rounded w-4/5" />
                        <div className="h-1.5 bg-stone-100 rounded w-3/5" />
                      </div>
                      <div className="mt-auto bg-orange-600 rounded text-white text-[8px] text-center py-1.5">Place order</div>
                    </>
                  )}
                  {screen.content === "confirmed" && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-1.5">
                      <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle2 size={14} className="text-green-600" />
                      </div>
                      <p className="text-[8px] font-semibold text-stone-700 text-center">Order confirmed</p>
                    </div>
                  )}
                </div>
                <p className="text-[9px] text-center text-stone-400 pb-2">{screen.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
