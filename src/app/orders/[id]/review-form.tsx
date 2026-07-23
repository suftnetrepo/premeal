"use client";

import { useState } from "react";
import { StarInput } from "@/app/components/stars";

export function ReviewForm({ orderId, onSubmitted }: { orderId: string; onSubmitted: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (rating === 0) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/orders/${orderId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not submit review");
      setSubmitting(false);
      return;
    }
    onSubmitted();
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <p className="text-sm font-medium mb-2">How was it?</p>
      <StarInput value={rating} onChange={setRating} />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Anything you'd want other customers to know? (optional)"
        className="mt-3 w-full border border-gray-200 rounded-lg p-2 text-sm resize-none"
        rows={2}
      />
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <button
        onClick={submit}
        disabled={submitting || rating === 0}
        className="mt-3 w-full bg-orange-600 disabled:bg-gray-300 text-white rounded-lg py-2.5 text-sm font-medium"
      >
        {submitting ? "Submitting…" : "Submit review"}
      </button>
    </div>
  );
}
