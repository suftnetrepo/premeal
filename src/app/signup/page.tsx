"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [role, setRole] = useState<"CUSTOMER" | "RESTAURANT_OWNER">("CUSTOMER");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        role,
        ...(role === "RESTAURANT_OWNER" ? { restaurantName, cuisine } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(
        typeof data.error === "string"
          ? data.error
          : (Object.values(data.error?.fieldErrors ?? {})[0] as string[])?.[0] ?? "Something went wrong"
      );
      setSubmitting(false);
      return;
    }
    router.push(role === "RESTAURANT_OWNER" ? "/restaurant/dashboard" : "/");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16 w-full">
      <h1 className="text-2xl font-semibold mb-6">Sign up</h1>

      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setRole("CUSTOMER")}
          className={`flex-1 text-sm rounded-lg p-2 border ${
            role === "CUSTOMER" ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-200"
          }`}
        >
          I&apos;m a customer
        </button>
        <button
          type="button"
          onClick={() => setRole("RESTAURANT_OWNER")}
          className={`flex-1 text-sm rounded-lg p-2 border ${
            role === "RESTAURANT_OWNER" ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-200"
          }`}
        >
          I run a restaurant
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          placeholder={role === "RESTAURANT_OWNER" ? "Your name" : "Name"}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border border-gray-200 rounded-lg p-3 text-sm"
          required
        />
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
          placeholder="Password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border border-gray-200 rounded-lg p-3 text-sm"
          minLength={8}
          required
        />
        {role === "RESTAURANT_OWNER" && (
          <>
            <input
              placeholder="Restaurant name"
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              className="border border-gray-200 rounded-lg p-3 text-sm"
              required
            />
            <input
              placeholder="Cuisine (e.g. Italian)"
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              className="border border-gray-200 rounded-lg p-3 text-sm"
              required
            />
          </>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="bg-orange-600 disabled:bg-gray-300 text-white rounded-lg p-3 text-sm font-medium"
        >
          {submitting ? "Creating account…" : "Sign up"}
        </button>
      </form>
      <p className="text-sm text-gray-500 mt-4">
        Already have an account? <Link href="/login" className="text-orange-600">Log in</Link>
      </p>
    </main>
  );
}
