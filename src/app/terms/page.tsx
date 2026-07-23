export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 w-full">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8">
        <p className="text-sm text-amber-800 font-medium mb-1">Draft — not reviewed by a lawyer</p>
        <p className="text-sm text-amber-700">
          This is a first-pass draft reflecting how Pre-Meal actually works, written to save a lawyer time,
          not to replace one. Every bracketed placeholder needs a real decision, and the whole document needs
          real legal review before this app takes orders from real customers. Nothing on this page is legal
          advice.
        </p>
      </div>

      <h1 className="text-2xl font-semibold mb-1">Terms of Service</h1>
      <p className="text-sm text-stone-400 mb-8">Draft — last updated [DATE]</p>

      <div className="flex flex-col gap-6 text-sm text-stone-600">
        <section>
          <h2 className="text-base font-semibold text-stone-900 mb-2">1. What Pre-Meal is</h2>
          <p>
            Pre-Meal (&quot;we&quot;, &quot;us&quot;) operates a platform where customers order food ahead of
            time for a scheduled delivery window, and independent restaurants confirm and fulfil those orders.
            Pre-Meal is a marketplace connecting customers and restaurants — restaurants prepare and deliver
            the food themselves; we are not the restaurant and do not prepare or deliver food ourselves.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-stone-900 mb-2">2. Accounts</h2>
          <p>
            You need an account to order or to list a restaurant. You&apos;re responsible for keeping your
            login credentials secure and for activity that happens under your account. You must be able to
            enter a legally binding contract to use Pre-Meal.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-stone-900 mb-2">3. How ordering works</h2>
          <p>
            When you place an order, your card is authorized but <strong>not charged</strong> until the
            restaurant confirms — restaurants have 30 minutes to respond. If they don&apos;t respond, or
            decline, your order is automatically cancelled and you are not charged. Once a restaurant
            confirms, your card is charged the full order total (food, any add-ons, and the delivery fee).
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-stone-900 mb-2">4. Cancellations & refunds</h2>
          <p>
            You can cancel for free any time before a restaurant confirms your order. Once confirmed, you can
            still cancel and receive a full refund up until the order is out for delivery; once it&apos;s left
            the restaurant, cancellation is no longer available and you should use the &quot;report a
            problem&quot; option instead if something is wrong with your order. A restaurant may also cancel
            an order it already accepted (for example, if they run out of an ingredient) — you&apos;ll be
            refunded in full if that happens.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-stone-900 mb-2">5. Payments</h2>
          <p>
            Payments are processed by Stripe. We never see or store your full card number. [COMPANY LEGAL
            NAME] charges a commission on the food portion of each order to the restaurant; restaurants keep
            100% of the delivery fee they set. Restaurants pay a one-time signup fee before their first order,
            described at the time they sign up.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-stone-900 mb-2">6. Promotions and subscriptions</h2>
          <p>
            Discount codes are subject to the specific terms shown when you apply them (minimum order,
            expiry, per-customer usage limits) and may be withdrawn or changed at any time. If Pre-Meal+ (a
            paid subscription) is available, its price and benefits are shown before you subscribe, and it
            can be cancelled at any time; cancelling stops future renewals but doesn&apos;t refund the current
            period.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-stone-900 mb-2">7. Restaurant listings</h2>
          <p>
            Restaurants are independent businesses, not Pre-Meal employees or agents. We review and approve
            restaurants before they go live and may reject or remove a listing at our discretion, including
            for repeated missed orders, food safety concerns, or fraud. Restaurants are solely responsible for
            the food they prepare, its quality, and complying with applicable food safety and licensing law.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-stone-900 mb-2">8. Reviews</h2>
          <p>
            You can only leave a review for an order that was actually delivered to you. Reviews must be your
            genuine experience — we may remove reviews that violate this or that are abusive, fraudulent, or
            otherwise inappropriate.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-stone-900 mb-2">9. Account suspension</h2>
          <p>
            We may suspend or terminate an account that violates these terms, engages in fraud, or abuses the
            platform (including its rate limits and automated systems).
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-stone-900 mb-2">10. Liability</h2>
          <p>
            [PLACEHOLDER — liability limitations, disclaimers, and indemnification need to be drafted by a
            lawyer familiar with marketplace platforms and your jurisdiction. Do not rely on generic template
            language for this section; it needs to be correct for your actual business structure and the food
            safety/consumer protection law that applies to you.]
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-stone-900 mb-2">11. Governing law</h2>
          <p>[PLACEHOLDER — depends on where the operating company is incorporated. Confirm with a lawyer.]</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-stone-900 mb-2">12. Contact</h2>
          <p>Questions about these terms: [CONTACT EMAIL]</p>
        </section>
      </div>
    </main>
  );
}
