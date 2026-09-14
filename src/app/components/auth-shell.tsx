import { CalendarCheck2, CheckCircle2, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

const benefits = [
  { icon: CalendarCheck2, text: "Schedule meals around your day" },
  { icon: CheckCircle2, text: "Order from verified restaurants" },
  { icon: ShieldCheck, text: "Secure checkout and account protection" },
];

export function AuthShell({ eyebrow, title, description, children }: AuthShellProps) {
  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[#F7F4EE]">
      <div className="absolute -left-32 top-20 h-72 w-72 rounded-full bg-orange-200/40 blur-3xl" />
      <div className="absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-emerald-100/60 blur-3xl" />

      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-8 px-4 py-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-10">
        <section className="hidden max-w-lg lg:block">
          <p className="text-xs font-bold tracking-[0.18em] text-orange-700">MEALS ON YOUR TIME</p>
          <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight text-stone-950 xl:text-5xl">
            Good food deserves a place in your plan.
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-stone-600">
            Discover local restaurants, choose a delivery window and enjoy the confidence of knowing your meal is organised.
          </p>
          <div className="mt-7 space-y-3">
            {benefits.map(({ icon: Icon, text }, index) => (
              <div key={text} className="flex items-center gap-3 text-sm font-medium text-stone-700">
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${index === 0 ? "bg-orange-100 text-orange-700" : index === 1 ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}>
                  <Icon size={18} strokeWidth={1.9} />
                </span>
                {text}
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-xl rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-[0_24px_70px_-30px_rgba(41,37,36,0.35)] backdrop-blur sm:p-8">
          <p className="text-xs font-bold tracking-[0.16em] text-orange-700">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-stone-600 sm:text-base">{description}</p>
          <div className="mt-5">{children}</div>
        </section>
      </div>
    </main>
  );
}
