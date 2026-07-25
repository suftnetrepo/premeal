"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

function PayButton({
  label,
  disabled,
  onPaymentMethod,
  onError,
  onRetryNeeded,
}: {
  label: string;
  disabled: boolean;
  onPaymentMethod: (paymentMethodId: string) => Promise<boolean>;
  onError: (message: string) => void;
  onRetryNeeded: () => Promise<void>;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    if (!stripe || !elements) return;
    setSubmitting(true);
    onError("");

    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });

    if (error) {
      onError(error.message ?? "Card could not be verified.");
      setSubmitting(false);
      return;
    }
    if (!setupIntent || typeof setupIntent.payment_method !== "string") {
      onError("Could not verify card.");
      setSubmitting(false);
      return;
    }

    // The card itself verified fine, but the order can still fail after
    // this — wrong delivery address, a slot that just filled up, a promo
    // code race, etc. onPaymentMethod now reports back whether placing
    // the order actually succeeded, so this button can re-enable itself
    // on failure instead of staying stuck on "Verifying card…" forever.
    // On success, the parent is about to navigate away, so resetting
    // `submitting` here is harmless — the component unmounts either way.
    const placed = await onPaymentMethod(setupIntent.payment_method);
    if (!placed) {
      // A SetupIntent can only be confirmed once — it's now in a
      // terminal "succeeded" state even though the order itself failed.
      // Retrying confirmSetup() against that same already-succeeded
      // intent isn't a supported flow, and is exactly what caused the
      // saved card to start showing as "failed" on a second attempt.
      // The real fix is a genuinely fresh SetupIntent before the retry,
      // not just re-enabling the button — the card details do need to
      // be re-entered, since they were tied to the intent that's now
      // used up, but that's the correct, honest cost of a real retry
      // rather than a broken one.
      await onRetryNeeded();
      setSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || submitting || !stripe}
      className="w-full bg-orange-600 disabled:bg-gray-300 text-white rounded-lg px-6 py-3 text-sm font-medium"
    >
      {submitting ? "Verifying card…" : label}
    </button>
  );
}

export function CheckoutPayment({
  label,
  disabled,
  onPaymentMethod,
}: {
  label: string;
  disabled: boolean;
  onPaymentMethod: (paymentMethodId: string) => Promise<boolean>;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  const fetchClientSecret = useCallback(async () => {
    // Dropping to null first (rather than just overwriting once the new
    // one arrives) matters — the component below has an early return for
    // !clientSecret that unmounts <Elements> entirely while this is in
    // flight, which is what actually gives PaymentElement a clean slate
    // for the new SetupIntent instead of trying to reuse stale state
    // tied to the old, already-consumed one.
    setClientSecret(null);
    setError(null);
    try {
      const res = await fetch("/api/checkout/setup-intent", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not start checkout");
        return;
      }
      setClientSecret(data.clientSecret);
    } catch {
      setError("Could not reach the server.");
    }
  }, []);

  useEffect(() => {
    // React Strict Mode intentionally double-fires effects in dev — without
    // this guard, that would create two SetupIntents (and, before the
    // server-side fix, could even create two different Stripe Customers).
    // Harmless with the server fix in place, but still wasteful to do twice.
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    fetchClientSecret();
  }, [fetchClientSecret]);

  if (!stripePromise) {
    return (
      <p className="text-sm text-red-600">
        Payments aren&apos;t configured yet (missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in .env).
      </p>
    );
  }

  if (error && !clientSecret) return <p className="text-sm text-red-600">{error}</p>;
  if (!clientSecret) return <p className="text-sm text-gray-400">Loading payment form…</p>;

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <div className="flex flex-col gap-3">
        <PaymentElement />
        <PayButton
          label={label}
          disabled={disabled}
          onPaymentMethod={onPaymentMethod}
          onError={setError}
          onRetryNeeded={fetchClientSecret}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Elements>
  );
}
