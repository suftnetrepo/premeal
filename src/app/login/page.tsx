"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      setSubmitting(false);
      return;
    }
    router.push(
      data.user.role === "RESTAURANT_OWNER"
        ? "/restaurant/dashboard"
        : data.user.role === "ADMIN"
          ? "/admin"
          : data.user.role === "DRIVER"
            ? "/driver/dashboard"
            : "/"
    );
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16 w-full">
      <h1 className="text-2xl font-semibold mb-6">Log in</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border border-gray-200 rounded-lg p-3 text-sm"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border border-gray-200 rounded-lg p-3 text-sm"
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="bg-orange-600 disabled:bg-gray-300 text-white rounded-lg p-3 text-sm font-medium"
        >
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="text-sm text-gray-500 mt-4">
        No account? <Link href="/signup" className="text-orange-600">Sign up</Link>
      </p>
      <p className="text-sm text-gray-500 mt-2">
        <Link href="/forgot-password" className="text-orange-600">Forgot password?</Link>
      </p>
      <p className="text-xs text-gray-400 mt-8">
        Demo restaurant logins (see prisma/seed.ts): <br />
        owner@sakurasushi.test / password123 <br />
        owner@luigiskitchen.test / password123
      </p>
    </main>
  );
}
