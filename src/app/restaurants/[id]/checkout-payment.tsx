"use client";

import { useEffect, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

function PayButton({
  label,
  disabled,
  onPaymentMethod,
  onError,
}: {
  label: string;
  disabled: boolean;
  onPaymentMethod: (paymentMethodId: string) => Promise<boolean>;
  onError: (message: string) => void;
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

  useEffect(() => {
    // React Strict Mode intentionally double-fires effects in dev — without
    // this guard, that would create two SetupIntents (and, before the
    // server-side fix, could even create two different Stripe Customers).
    // Harmless with the server fix in place, but still wasteful to do twice.
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    fetch("/api/checkout/setup-intent", { method: "POST" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : "Could not start checkout");
          return;
        }
        setClientSecret(data.clientSecret);
      })
      .catch(() => setError("Could not reach the server."));
  }, []);

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
        <PayButton label={label} disabled={disabled} onPaymentMethod={onPaymentMethod} onError={setError} />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Elements>
  );
}
