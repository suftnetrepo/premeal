"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(new URLSearchParams(window.location.search).get("token"));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not reset password");
        setSubmitting(false);
        return;
      }
      router.push(data.user.role === "RESTAURANT_OWNER" ? "/restaurant/dashboard" : data.user.role === "ADMIN" ? "/admin" : "/");
    } catch {
      setError("Could not reach the server.");
      setSubmitting(false);
    }
  }

  if (token === null) {
    return <main className="mx-auto max-w-sm px-4 py-16 w-full" />;
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-sm px-4 py-16 w-full text-center">
        <p className="text-4xl mb-3">⚠️</p>
        <h1 className="text-xl font-semibold mb-1">Missing reset link</h1>
        <p className="text-sm text-gray-500 mb-6">Use the link from your password reset email.</p>
        <Link href="/forgot-password" className="text-sm text-orange-600">
          Request a new one
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16 w-full">
      <h1 className="text-xl font-semibold mb-1">Set a new password</h1>
      <p className="text-sm text-gray-500 mb-6">You&apos;ll be logged in on this device once it&apos;s done.</p>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          className="border border-gray-200 rounded-lg p-2.5 text-sm"
          required
          minLength={8}
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          className="border border-gray-200 rounded-lg p-2.5 text-sm"
          required
          minLength={8}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="bg-orange-600 disabled:bg-gray-300 text-white rounded-lg py-2.5 text-sm font-medium"
        >
          {submitting ? "Saving…" : "Set new password"}
        </button>
      </form>
    </main>
  );
}
