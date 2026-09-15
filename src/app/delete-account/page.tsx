export default function DeleteAccountPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 w-full">
      <h1 className="text-2xl font-semibold mb-1">Delete your Nriya account</h1>
      <p className="text-sm text-stone-400 mb-8">Nriya is developed by Suftnet</p>

      <div className="flex flex-col gap-6 text-sm text-stone-600">
        <section>
          <h2 className="text-base font-semibold text-stone-900 mb-2">How to request deletion</h2>
          <p className="mb-3">In the Nriya app:</p>
          <ol className="list-decimal pl-5 flex flex-col gap-1.5">
            <li>Open the Nriya app and log in</li>
            <li>Go to the <strong>Account</strong> tab</li>
            <li>
              Scroll down and tap <strong>Delete account</strong>, at the bottom of the screen
            </li>
            <li>Confirm when prompted</li>
          </ol>
          <p className="mt-3">
            Your account is deleted immediately — there&apos;s no waiting period, and no need to contact us
            first.
          </p>
          <p className="mt-3">
            Can&apos;t log in — forgotten password, uninstalled the app, or lost access to your email? Email{" "}
            <a href="mailto:info@suftnet.com" className="text-orange-600 underline">
              info@suftnet.com
            </a>{" "}
            from the address on your account (or tell us which email it was registered with) and we&apos;ll
            delete it for you.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-stone-900 mb-2">What gets deleted</h2>
          <p>Immediately and permanently, for every account:</p>
          <ul className="list-disc pl-5 flex flex-col gap-1 mt-2">
            <li>Your name, email address, and password</li>
            <li>Your saved delivery addresses</li>
            <li>Your Stripe customer reference (we never stored your card details ourselves — see our Privacy Policy)</li>
            <li>Any active login sessions, which are invalidated straight away</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-stone-900 mb-2">What&apos;s kept, and why</h2>
          <p>
            If you&apos;ve never placed an order, left a review, or redeemed a promo code, nothing about your
            account is kept at all — the account record itself is removed.
          </p>
          <p className="mt-2">
            If you have order or review history, the orders and reviews themselves are kept — restaurants are
            entitled to keep their own transaction records, and other customers rely on reviews staying up.
            But they&apos;re disconnected from you: your name and email on those records are replaced with a
            generic &quot;Deleted user&quot; placeholder, and the anonymized account can never be logged into
            again. There&apos;s no separate retention period for this — the anonymization happens at the same
            time as the rest of the deletion, immediately.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-stone-900 mb-2">More about your data</h2>
          <p>
            For the full picture of what we collect and why, see our{" "}
            <a href="/privacy" className="text-orange-600 underline">
              Privacy Policy
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
