"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DriverAcceptInvitePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(new URLSearchParams(window.location.search).get("token"));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/driver/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not set up your account");
        setSubmitting(false);
        return;
      }
      router.push("/driver/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
      setSubmitting(false);
    }
  }

  if (token === null) return null; // brief moment while reading the URL — avoids a flash of the "missing token" state

  if (!token) {
    return (
      <main className="mx-auto max-w-sm px-4 py-16 w-full text-center">
        <p className="text-sm text-stone-500">This invite link is missing its token — check the link in your email is complete.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16 w-full">
      <h1 className="text-2xl font-bold mb-1">Set up your driver account</h1>
      <p className="text-sm text-stone-500 mb-6">You&apos;ve been invited to deliver on Pre-Meal.</p>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="border border-stone-200 rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="password"
          placeholder="Choose a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="border border-stone-200 rounded-lg px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="bg-orange-600 disabled:bg-stone-300 text-white rounded-lg px-4 py-2 text-sm font-medium"
        >
          {submitting ? "Setting up…" : "Create account"}
        </button>
      </form>
    </main>
  );
}
