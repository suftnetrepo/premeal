import Link from "next/link";
import { CalendarClock, CheckCircle2, Truck, BadgeCheck } from "lucide-react";

export default function HowItWorksPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-20 w-full">
      <p className="text-xs font-semibold tracking-widest text-orange-600 mb-3">HOW IT WORKS</p>
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-stone-900 mb-6">
        Order ahead, on your schedule.
      </h1>

      <div className="flex flex-col gap-8 text-stone-600">
        <p>
          Pre-Meal is built around ordering ahead, not rushing a delivery out the door. Here&apos;s
          what actually happens between placing an order and it arriving.
        </p>

        <div className="flex flex-col gap-6">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
              <CalendarClock size={18} strokeWidth={1.75} />
            </div>
            <div>
              <p className="font-semibold text-stone-900 mb-1">1. Schedule ahead</p>
              <p className="text-sm">
                Pick a restaurant and a delivery day and window that actually suits you — not
                whatever slot happens to be free right now. Your card isn&apos;t charged yet.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
              <CheckCircle2 size={18} strokeWidth={1.75} />
            </div>
            <div>
              <p className="font-semibold text-stone-900 mb-1">2. The restaurant confirms within 30 minutes</p>
              <p className="text-sm">
                Your order goes straight to the restaurant. They confirm they can actually make it
                for your chosen slot — that&apos;s the moment your card is charged. If they can&apos;t,
                or don&apos;t respond in time, you&apos;re never charged at all.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
              <Truck size={18} strokeWidth={1.75} />
            </div>
            <div>
              <p className="font-semibold text-stone-900 mb-1">3. Track it through to delivery</p>
              <p className="text-sm">
                Your order page updates as it moves — being prepared, out for delivery, delivered —
                so you always know where things stand, right up to your chosen window.
              </p>
            </div>
          </div>
        </div>

        <section className="border-t border-stone-100 pt-8">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
              <BadgeCheck size={18} strokeWidth={1.75} />
            </div>
            <div>
              <p className="font-semibold text-stone-900 mb-1">Registered & verified</p>
              <p className="text-sm">
                Every new restaurant confirms real food safety registration before joining our
                platform — we don&apos;t approve one without it on file.{" "}
                <Link href="/food-safety" className="text-orange-600 underline">
                  Read more about how we check
                </Link>
                .
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
