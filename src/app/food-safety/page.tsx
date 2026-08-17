import Link from "next/link";

export default function FoodSafetyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-20 w-full">
      <p className="text-xs font-semibold tracking-widest text-orange-600 mb-3">FOOD SAFETY</p>
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-stone-900 mb-6">
        How we check food safety.
      </h1>

      <div className="flex flex-col gap-8 text-stone-600">
        <p>
          There are two separate layers here — one every restaurant on Pre-Meal goes through, and one
          that&apos;s optional. We&apos;d rather explain both plainly than let either one sound bigger than
          it is.
        </p>

        <section>
          <h2 className="text-lg font-bold text-stone-900 mb-2">1. Mandatory: registration, before joining</h2>
          <p className="mb-2">
            Before we approve any new restaurant to start taking orders, the owner has to upload proof of
            their real local-authority food safety registration and confirm a legal acknowledgement — we
            don&apos;t approve a restaurant without both on file. It&apos;s a one-time gate at onboarding,
            checked by our team, not a customer-facing rating.
          </p>
          <p>
            This applies to every restaurant that has joined since we introduced the requirement. A small
            number of restaurants already on the platform before this check existed haven&apos;t been through
            it retroactively yet — we&apos;re working through bringing them up to the same standard rather
            than quietly grandfathering them in.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-stone-900 mb-2">2. Optional: an advanced hygiene certificate</h2>
          <p className="mb-2">
            Separately, any restaurant can choose to submit an official UK food hygiene training certificate
            (Level 1 through Level 4) from their settings, at any point — not just when they join. It&apos;s
            entirely optional and has no effect on whether they&apos;re allowed to operate here.
          </p>
          <p>
            Our team reviews the document and the claimed level before approving it. A restaurant&apos;s
            badge — for example &quot;Level 2 Food Hygiene Certified&quot; — only ever appears on their page
            once we&apos;ve actually verified it. A pending or rejected submission shows nothing at all: we
            don&apos;t give partial credit for a claim we haven&apos;t confirmed.
          </p>
        </section>

        <p className="text-sm text-stone-400 border-t border-stone-100 pt-6">
          Questions about either of these?{" "}
          <a href="mailto:info@suftnet.com" className="text-orange-600 underline">
            info@suftnet.com
          </a>
          . See also our{" "}
          <Link href="/privacy" className="text-orange-600 underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
