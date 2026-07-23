"use client";

import { useState } from "react";

export function EmailVerificationBanner({ email }: { email: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (dismissed) return null;

  async function resend() {
    setSending(true);
    await fetch("/api/auth/resend-verification", { method: "POST" });
    setSending(false);
    setSent(true);
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="mx-auto max-w-2xl px-4 py-2 flex items-center justify-between gap-3 text-xs">
        <p className="text-amber-800">
          {sent ? (
            <>Verification email sent to {email}.</>
          ) : (
            <>Please verify your email ({email}) to secure your account.</>
          )}
        </p>
        <div className="flex items-center gap-3 shrink-0">
          {!sent && (
            <button onClick={resend} disabled={sending} className="text-amber-900 font-medium underline">
              {sending ? "Sending…" : "Resend email"}
            </button>
          )}
          <button onClick={() => setDismissed(true)} className="text-amber-700">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
