"use client";

import { useState } from "react";

/** Static — for showing an existing average rating. Supports half-stars visually via rounding to nearest 0.5. */
export function StarDisplay({ rating, size = "text-sm" }: { rating: number; size?: string }) {
  const rounded = Math.round(rating * 2) / 2;
  return (
    <span className={`${size} text-amber-500 tracking-tight`} aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n}>{n <= rounded ? "★" : n - 0.5 === rounded ? "⯪" : "☆"}</span>
      ))}
    </span>
  );
}

/** Interactive — click to pick a rating 1-5, used on the "rate this order" form. */
export function StarInput({ value, onChange }: { value: number; onChange: (rating: number) => void }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const display = hovered ?? value;

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(null)}
          className="text-2xl leading-none"
          aria-label={`Rate ${n} out of 5`}
        >
          <span className={n <= display ? "text-amber-500" : "text-gray-300"}>★</span>
        </button>
      ))}
    </div>
  );
}
