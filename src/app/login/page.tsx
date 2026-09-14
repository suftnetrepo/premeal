"use client";

import { useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { RECAPTCHA_SCRIPT_SRC, getRecaptchaToken } from "@/lib/recaptcha-client";
import { AuthShell } from "@/app/components/auth-shell";

const inputClassName = "h-12 w-full rounded-xl border border-stone-200 bg-stone-50 pl-11 pr-4 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100";

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
    try {
      const recaptchaToken = await getRecaptchaToken("login");
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, ...(recaptchaToken ? { recaptchaToken } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
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
    } catch {
      setError("We couldn't log you in. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell eyebrow="WELCOME BACK" title="Log in to Nriya" description="Continue to your orders, saved addresses or restaurant workspace.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-semibold text-stone-800">Email address</label>
          <div className="relative">
            <Mail aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClassName} required />
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-4">
            <label htmlFor="password" className="text-sm font-semibold text-stone-800">Password</label>
            <Link href="/forgot-password" className="text-sm font-semibold text-orange-700 hover:text-orange-800">Forgot password?</Link>
          </div>
          <div className="relative">
            <LockKeyhole aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input id="password" name="password" type="password" placeholder="Enter your password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClassName} required />
          </div>
        </div>
        {error && <p role="alert" aria-live="polite" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="mt-0.5 shrink-0" size={16} />{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 text-sm font-bold text-white shadow-lg shadow-orange-600/20 transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:shadow-none"
        >
          {submitting ? "Logging in…" : <>Log in <ArrowRight size={17} /></>}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-stone-600">New to Nriya? <Link href="/signup" className="font-bold text-orange-700 hover:text-orange-800">Create an account</Link></p>
      {process.env.NODE_ENV === "development" && (
        <aside className="mt-5 rounded-xl border border-dashed border-stone-300 bg-stone-50 p-3 text-xs leading-5 text-stone-500">
          <p className="font-bold text-stone-700">Development demo accounts</p>
          <p className="mt-1">owner@sakurasushi.test / password123</p>
          <p>owner@luigiskitchen.test / password123</p>
        </aside>
      )}
      {RECAPTCHA_SCRIPT_SRC && <Script src={RECAPTCHA_SCRIPT_SRC} strategy="afterInteractive" />}
    </AuthShell>
  );
}
