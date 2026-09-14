"use client";

import { useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, ChefHat, LockKeyhole, Mail, UserRound, UsersRound, UtensilsCrossed } from "lucide-react";
import { RECAPTCHA_SCRIPT_SRC, getRecaptchaToken } from "@/lib/recaptcha-client";
import { AuthShell } from "@/app/components/auth-shell";

const inputClassName = "h-12 w-full rounded-xl border border-stone-200 bg-stone-50 pl-11 pr-4 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100";

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
    try {
      const recaptchaToken = await getRecaptchaToken("signup");
      const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        role,
        ...(role === "RESTAURANT_OWNER" ? { restaurantName, cuisine } : {}),
        ...(recaptchaToken ? { recaptchaToken } : {}),
      }),
    });
      const data = await res.json();
      if (!res.ok) {
        setError(
        typeof data.error === "string"
          ? data.error
          : (Object.values(data.error?.fieldErrors ?? {})[0] as string[])?.[0] ?? "Something went wrong"
        );
        return;
      }
      router.push(role === "RESTAURANT_OWNER" ? "/restaurant/dashboard" : "/");
      router.refresh();
    } catch {
      setError("We couldn't create your account. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell eyebrow="JOIN NRIYA" title="Create your account" description="Choose how you’ll use Nriya, then tell us a little about yourself.">
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-stone-100 p-1.5" role="group" aria-label="Account type">
        <button
          type="button"
          onClick={() => setRole("CUSTOMER")}
          className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${
            role === "CUSTOMER" ? "bg-white text-orange-700 shadow-sm ring-1 ring-stone-200" : "text-stone-500 hover:text-stone-800"
          }`}
        >
          <UsersRound size={17} /> Customer
        </button>
        <button
          type="button"
          onClick={() => setRole("RESTAURANT_OWNER")}
          className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${
            role === "RESTAURANT_OWNER" ? "bg-white text-orange-700 shadow-sm ring-1 ring-stone-200" : "text-stone-500 hover:text-stone-800"
          }`}
        >
          <ChefHat size={17} /> Restaurant
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
        <AuthField id="name" label={role === "RESTAURANT_OWNER" ? "Your name" : "Full name"} placeholder="Enter your name" icon={UserRound} value={name} onChange={setName} autoComplete="name" />
        <AuthField id="email" label="Email address" placeholder="you@example.com" icon={Mail} value={email} onChange={setEmail} type="email" autoComplete="email" />
        <AuthField id="password" label="Password" hint="At least 8 characters" placeholder="Create a secure password" icon={LockKeyhole} value={password} onChange={setPassword} type="password" autoComplete="new-password" minLength={8} />
        {role === "RESTAURANT_OWNER" && (
          <div className="grid gap-4 border-t border-stone-200 pt-4 sm:grid-cols-2">
            <AuthField id="restaurantName" label="Restaurant name" placeholder="Your business name" icon={ChefHat} value={restaurantName} onChange={setRestaurantName} autoComplete="organization" />
            <AuthField id="cuisine" label="Cuisine" placeholder="e.g. Italian" icon={UtensilsCrossed} value={cuisine} onChange={setCuisine} />
          </div>
        )}
        {error && <p role="alert" aria-live="polite" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="mt-0.5 shrink-0" size={16} />{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 text-sm font-bold text-white shadow-lg shadow-orange-600/20 transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:shadow-none"
        >
          {submitting ? "Creating account…" : <>Create account <ArrowRight size={17} /></>}
        </button>
      </form>
      <p className="mt-4 text-center text-xs leading-5 text-stone-500">By creating an account, you agree to our <Link href="/terms" className="font-semibold text-stone-700 hover:text-orange-700">Terms</Link> and <Link href="/privacy" className="font-semibold text-stone-700 hover:text-orange-700">Privacy Policy</Link>.</p>
      <p className="mt-4 text-center text-sm text-stone-600">Already have an account? <Link href="/login" className="font-bold text-orange-700 hover:text-orange-800">Log in</Link></p>
      {RECAPTCHA_SCRIPT_SRC && <Script src={RECAPTCHA_SCRIPT_SRC} strategy="afterInteractive" />}
    </AuthShell>
  );
}

type AuthFieldProps = {
  id: string;
  label: string;
  hint?: string;
  placeholder: string;
  icon: React.ComponentType<{ className?: string; size?: number; "aria-hidden"?: boolean }>;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  minLength?: number;
};

function AuthField({ id, label, hint, placeholder, icon: Icon, value, onChange, type = "text", autoComplete, minLength }: AuthFieldProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-stone-800">{label}</label>
        {hint && <span className="text-xs text-stone-400">{hint}</span>}
      </div>
      <div className="relative">
        <Icon aria-hidden={true} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
        <input id={id} name={id} type={type} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} className={inputClassName} autoComplete={autoComplete} minLength={minLength} required />
      </div>
    </div>
  );
}
