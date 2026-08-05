"use client";

// Ambient declaration for the global `grecaptcha` object the reCAPTCHA v3
// script (loaded via <Script src={RECAPTCHA_SCRIPT_SRC}> on the login/signup
// pages) attaches to `window`. Declared once here rather than per-page.
declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

// `render=<site key>` loads v3 in "invisible" mode — no checkbox/badge UI,
// just a script that execute() can be called against on submit.
export const RECAPTCHA_SCRIPT_SRC = SITE_KEY
  ? `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`
  : undefined;

/**
 * Resolves a fresh, action-scoped reCAPTCHA v3 token, or `null` if the
 * site key isn't configured or the script hasn't loaded/failed to execute
 * for any reason (ad blocker, offline, Google outage, etc.) — deliberately
 * fails open on the client rather than blocking a real user from
 * submitting the form over a third-party script hiccup. The backend
 * treats a missing token as "can't verify" and lets the request proceed
 * unchecked (see src/lib/recaptcha.ts) rather than rejecting it, so this
 * degrades to "no bot protection for this one submission," not "user is
 * locked out."
 */
export function getRecaptchaToken(action: string): Promise<string | null> {
  if (!SITE_KEY || typeof window === "undefined" || !window.grecaptcha) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    window.grecaptcha!.ready(() => {
      window
        .grecaptcha!.execute(SITE_KEY, { action })
        .then(resolve)
        .catch((err) => {
          console.error("[recaptcha] execute failed:", err);
          resolve(null);
        });
    });
  });
}
