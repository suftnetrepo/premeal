export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 w-full">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8">
        <p className="text-sm text-amber-800 font-medium mb-1">Draft — not reviewed by a lawyer</p>
        <p className="text-sm text-amber-700">
          This is a first-pass draft listing the data this app actually collects and the real third parties
          it actually sends data to, written to save a lawyer time, not to replace one. It does not satisfy
          GDPR, CCPA, or any other real requirement on its own — every bracketed placeholder needs a real
          decision, and the whole document needs real legal review before this app collects data from real
          customers. Nothing on this page is legal advice.
        </p>
      </div>

      <h1 className="text-2xl font-semibold mb-1">Privacy Policy</h1>
      <p className="text-sm text-stone-400 mb-8">Draft — last updated [DATE]</p>

      <div className="flex flex-col gap-6 text-sm text-stone-600">
        <section>
          <h2 className="text-base font-semibold text-stone-900 mb-2">1. What we collect</h2>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>Name and email address, when you create an account</li>
            <li>Your password, stored as a salted hash (scrypt) — we never store or can see your actual password</li>
            <li>Delivery addresses you save or enter at checkout, including approximate coordinates (geocoded from the address) used to check whether a restaurant delivers there</li>
            <li>Order history: what you ordered, when, from which restaurant, and the amount charged</li>
            <li>Reviews you write</li>
            <li>For restaurant owners: your restaurant&apos;s name, address, menu, and photos you upload</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-stone-900 mb-2">2. What we don&apos;t collect</h2>
          <p>
            We never see or store your full card number, expiry date, or CVC — card details go directly to
            Stripe. We don&apos;t track you across other websites, and we don&apos;t sell personal data to
            third parties.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-stone-900 mb-2">3. Third parties we actually use</h2>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li><strong>Stripe</strong> — processes all payments and payouts; see Stripe&apos;s own privacy policy for what they hold</li>
            <li><strong>Brevo</strong> — sends transactional emails (order updates) and, if you&apos;re a customer or restaurant owner, occasional broadcast emails from us</li>
            <li><strong>Cloudinary</strong> — hosts photos uploaded for menu items and restaurant profiles</li>
            <li><strong>Mapbox / OpenStreetMap (Nominatim)</strong> — converts addresses you enter into approximate coordinates, used only to check delivery range and show distance</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-stone-900 mb-2">4. Cookies</h2>
          <p>
            We use a single session cookie to keep you logged in. It contains a signed token identifying your
            account — it is not used for advertising or cross-site tracking, and we don&apos;t currently use
            any analytics or advertising cookies. [If that changes — analytics, ad tracking, etc. — this
            section needs updating and likely a cookie consent banner.]
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-stone-900 mb-2">5. How long we keep data</h2>
          <p>
            [PLACEHOLDER — a real retention policy needs a business decision: how long order history, account
            data, and uploaded images are kept after an account is closed, and the process for deleting them.]
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-stone-900 mb-2">6. Your rights</h2>
          <p>
            Depending on where you live, you may have rights to access, correct, or delete your personal data,
            or to object to certain processing. [PLACEHOLDER — the specific rights and how to exercise them
            depend on your jurisdiction (e.g. GDPR if operating in the UK/EU) and need real legal drafting.]
            To ask about your data, contact [CONTACT EMAIL].
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-stone-900 mb-2">7. Restaurant owners</h2>
          <p>
            If you sign up a restaurant, your business name, address, and bank/payout details (handled
            directly by Stripe, not stored by us) are used to run your restaurant on the platform and pay you
            for orders. Customers can see your restaurant&apos;s name, menu, delivery area, and reviews.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-stone-900 mb-2">8. Contact</h2>
          <p>Questions about this policy or your data: [CONTACT EMAIL]</p>
        </section>
      </div>
    </main>
  );
}
