import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarClock, CheckCircle2, Truck } from "lucide-react";

const steps = [
  { number: "01", icon: CalendarClock, iconClass: "bg-orange-100 text-orange-700", numberClass: "text-orange-100", title: "Choose when you want it", copy: "Pick a restaurant, delivery day and window that fits your plans. Your card is not charged yet." },
  { number: "02", icon: CheckCircle2, iconClass: "bg-emerald-100 text-emerald-700", numberClass: "text-emerald-100", title: "The restaurant confirms", copy: "The restaurant has 30 minutes to confirm it can prepare your order for that slot. Your card is charged only when they accept." },
  { number: "03", icon: Truck, iconClass: "bg-sky-100 text-sky-700", numberClass: "text-sky-100", title: "Follow it to your door", copy: "Track the order as it is prepared, sent out and delivered within your chosen window." },
];

export default function HowItWorksPage() {
  return (
    <main className="w-full bg-white">
      <section className="border-b border-stone-200 bg-stone-50">
        <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:py-24">
          <p className="mb-5 inline-flex rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-bold tracking-[0.16em] text-orange-700">HOW IT WORKS</p>
          <h1 className="mx-auto max-w-3xl text-4xl font-black tracking-tight text-stone-950 sm:text-6xl sm:leading-[1.05]">
            Order ahead. Eat <span className="text-orange-600">right on time.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-stone-600">
            Nriya replaces the rush with a simple scheduled journey—from choosing your slot to receiving your meal.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:py-20">
        <div className="grid gap-5 lg:grid-cols-3">
          {steps.map(({ number, icon: Icon, iconClass, numberClass, title, copy }) => (
            <article key={number} className="relative rounded-3xl border border-stone-200 bg-white p-7 shadow-sm">
              <span className={`absolute right-6 top-5 text-5xl font-black tracking-tighter ${numberClass}`}>{number}</span>
              <div className={`relative flex h-12 w-12 items-center justify-center rounded-2xl ${iconClass}`}><Icon size={22} strokeWidth={1.8} /></div>
              <h2 className="relative mt-7 text-xl font-bold text-stone-900">{title}</h2>
              <p className="relative mt-3 text-sm leading-6 text-stone-600">{copy}</p>
            </article>
          ))}
        </div>

        <div className="mt-8 flex gap-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 sm:items-center sm:p-8">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm"><BadgeCheck size={23} strokeWidth={1.8} /></div>
          <div>
            <h2 className="font-bold text-stone-900">Registered and verified restaurants</h2>
            <p className="mt-1 text-sm leading-6 text-stone-600">
              Every new restaurant confirms real food-safety registration before joining the platform. We do not approve one without it on file. {" "}
              <Link href="/food-safety" className="font-semibold text-emerald-700 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-800">See how we check</Link>.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20">
        <div className="flex flex-col items-start justify-between gap-7 rounded-3xl border border-stone-200 bg-[#F7F4EE] px-6 py-9 text-stone-900 sm:px-10 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-orange-700">YOUR NEXT MEAL, PLANNED</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Choose a restaurant and reserve your slot.</h2>
          </div>
          <Link href="/" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-orange-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-700">Start an order <ArrowRight size={16} /></Link>
        </div>
      </section>
    </main>
  );
}
