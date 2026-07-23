"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

export function PaymentActionVerify({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    if (!stripePromise) {
      setError("Payments aren't configured yet.");
      return;
    }
    setVerifying(true);
    setError(null);

    try {
      const secretRes = await fetch(`/api/orders/${orderId}/payment-action`);
      const secretData = await secretRes.json();
      if (!secretRes.ok) {
        setError(typeof secretData.error === "string" ? secretData.error : "Could not start verification");
        setVerifying(false);
        return;
      }

      const stripe = await stripePromise;
      if (!stripe) {
        setError("Could not load Stripe.");
        setVerifying(false);
        return;
      }

      // No card re-entry: the PaymentIntent already has the payment method
      // attached from the original charge attempt at confirmation. This
      // just completes whatever authentication step the card issuer wants
      // (a 3D Secure modal/redirect, handled entirely by Stripe.js).
      const { error: stripeError } = await stripe.confirmCardPayment(secretData.clientSecret);
      if (stripeError) {
        setError(stripeError.message ?? "Verification failed.");
        setVerifying(false);
        return;
      }

      const completeRes = await fetch(`/api/orders/${orderId}/complete-payment-action`, { method: "POST" });
      const completeData = await completeRes.json();
      if (!completeRes.ok) {
        setError(typeof completeData.error === "string" ? completeData.error : "Could not finish verification");
        setVerifying(false);
        return;
      }

      if (completeData.status === "still_requires_action") {
        setError("Verification wasn't completed — try again.");
        setVerifying(false);
        return;
      }

      // "succeeded" or "failed" both change the order's status — let the
      // parent refetch and show whatever the new state is.
      onDone();
    } catch {
      setError("Could not reach the server.");
      setVerifying(false);
    }
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <p className="text-sm font-medium text-amber-800 mb-1">Your bank needs you to verify this payment</p>
      <p className="text-xs text-amber-700 mb-3">
        The restaurant has accepted your order — we just need you to confirm the charge with your bank
        before it&apos;s fully placed.
      </p>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <button
        onClick={verify}
        disabled={verifying}
        className="w-full bg-orange-600 disabled:bg-gray-300 text-white rounded-lg py-2.5 text-sm font-medium"
      >
        {verifying ? "Verifying…" : "Verify payment"}
      </button>
    </div>
  );
}
