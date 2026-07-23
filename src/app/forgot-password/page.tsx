"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Something went wrong");
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Could not reach the server.");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16 w-full">
      <h1 className="text-xl font-semibold mb-1">Reset your password</h1>
      <p className="text-sm text-gray-500 mb-6">Enter your account email and we&apos;ll send a reset link.</p>

      {done ? (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          If an account exists for that email, a reset link is on its way.
        </p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="border border-gray-200 rounded-lg p-2.5 text-sm"
            required
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="bg-orange-600 disabled:bg-gray-300 text-white rounded-lg py-2.5 text-sm font-medium"
          >
            {submitting ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}

      <Link href="/login" className="text-sm text-gray-500 mt-4 inline-block">
        ← Back to log in
      </Link>
    </main>
  );
}
