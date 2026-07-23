"use client";

import { useState } from "react";
import { Megaphone } from "lucide-react";

export default function AdminBroadcastPage() {
  const [audience, setAudience] = useState<"CUSTOMER" | "RESTAURANT_OWNER" | "ALL">("CUSTOMER");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sent: number; failed: number; totalRecipients: number } | null>(null);

  async function send() {
    if (!subject.trim() || !message.trim()) return;
    if (!confirm(`Send this to every ${audience === "ALL" ? "user" : audience.toLowerCase().replace("_", " ")}? This can't be undone.`)) {
      return;
    }
    setSending(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/admin/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience, subject, message }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not send broadcast");
      setSending(false);
      return;
    }
    setResult(data);
    setSending(false);
  }

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-10 w-full">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
          <Megaphone size={16} strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-black tracking-tight text-stone-900">Broadcast</h1>
      </div>
      <p className="text-sm text-stone-500 mb-8">
        Sends a one-off email to every user matching the audience you pick. There&apos;s no queue yet — for a very
        large user base this would need one, but it&apos;s fine at today&apos;s scale.
      </p>

      <div className="flex flex-col gap-3 max-w-md">
        <label className="text-xs text-stone-500">
          Audience
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value as typeof audience)}
            className="mt-1 w-full border border-stone-200 rounded-xl p-2.5 text-sm"
          >
            <option value="CUSTOMER">Customers</option>
            <option value="RESTAURANT_OWNER">Restaurant owners</option>
            <option value="ALL">Everyone</option>
          </select>
        </label>

        <label className="text-xs text-stone-500">
          Subject
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full border border-stone-200 rounded-xl p-2.5 text-sm"
          />
        </label>

        <label className="text-xs text-stone-500">
          Message
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            className="mt-1 w-full border border-stone-200 rounded-xl p-2.5 text-sm resize-none"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {result && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
            Sent to {result.sent} of {result.totalRecipients} recipient{result.totalRecipients === 1 ? "" : "s"}
            {result.failed > 0 && ` (${result.failed} failed)`}.
          </p>
        )}

        <button
          onClick={send}
          disabled={sending || !subject.trim() || !message.trim()}
          className="bg-orange-600 disabled:bg-stone-300 text-white rounded-xl py-2.5 text-sm font-medium"
        >
          {sending ? "Sending…" : "Send broadcast"}
        </button>
      </div>
    </main>
  );
}
