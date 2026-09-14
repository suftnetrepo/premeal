import Link from "next/link";
import { ArrowRight, CalendarClock, Store, UtensilsCrossed } from "lucide-react";

const principles = [
  { icon: CalendarClock, iconClass: "bg-orange-100 text-orange-700", title: "Plan around real life", copy: "Choose a delivery window that fits your day instead of rearranging your day around an immediate delivery." },
  { icon: UtensilsCrossed, iconClass: "bg-emerald-100 text-emerald-700", title: "Give kitchens clarity", copy: "Restaurants receive a real scheduled order and confirm they can prepare it for the time you selected." },
  { icon: Store, iconClass: "bg-sky-100 text-sky-700", title: "Keep restaurants sustainable", copy: "Restaurants keep their full delivery fee and pay commission only on food they actually sell." },
];

export default function AboutPage() {
  return (
    <main className="w-full overflow-hidden bg-white">
      <section className="relative border-b border-stone-200 bg-stone-50">
        <div className="absolute -top-24 -right-20 h-72 w-72 rounded-full bg-orange-100/70 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:py-28">
          <div className="max-w-3xl">
            <p className="mb-5 inline-flex rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-bold tracking-[0.16em] text-orange-700">ABOUT NRIYA</p>
            <h1 className="text-4xl font-black tracking-tight text-stone-950 sm:text-6xl sm:leading-[1.05]">
              Food delivery designed around <span className="text-orange-600">your schedule.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-stone-600">
              Not every meal needs to arrive in twenty minutes. Nriya makes ordering ahead feel simple, dependable and better for everyone involved.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-orange-600">WHY WE BUILT IT</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-stone-900">A calmer way to order.</h2>
          </div>
          <div className="space-y-5 text-base leading-7 text-stone-600 sm:text-lg sm:leading-8">
            <p>Sometimes you know exactly when you want to eat: after a meeting ends, when guests arrive, or at the dinner time you already planned around.</p>
            <p>With Nriya, you order ahead and choose a delivery window. The restaurant then confirms within 30 minutes, giving you confidence in the plan and giving the kitchen time to prepare properly.</p>
          </div>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {principles.map(({ icon: Icon, iconClass, title, copy }) => (
            <article key={title} className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconClass}`}><Icon size={21} strokeWidth={1.8} /></div>
              <h3 className="mt-5 text-lg font-bold text-stone-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-stone-600">{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20">
        <div className="flex flex-col items-start justify-between gap-7 rounded-3xl border border-stone-200 bg-[#F7F4EE] px-6 py-9 text-stone-900 sm:px-10 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-orange-700">READY WHEN YOU ARE</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Plan your next meal with Nriya.</h2>
          </div>
          <Link href="/" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-orange-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-700">Find restaurants <ArrowRight size={16} /></Link>
        </div>
      </section>
    </main>
  );
}
