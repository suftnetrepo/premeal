"use client";

import { useEffect, useRef, useState } from "react";

type Suggestion = { latitude: number; longitude: number; formattedAddress: string };

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  onBlur,
  placeholder,
  className,
}: {
  value: string;
  onChange: (text: string) => void;
  onSelect?: (suggestion: Suggestion) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextFetchRef = useRef(false);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleChange(text: string) {
    onChange(text);

    if (skipNextFetchRef.current) {
      // Just selected a suggestion — don't immediately re-query for it.
      skipNextFetchRef.current = false;
      setOpen(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/geocode/suggest?q=${encodeURIComponent(text)}`);
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
        setOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  function handleSelect(suggestion: Suggestion) {
    skipNextFetchRef.current = true;
    onChange(suggestion.formattedAddress);
    onSelect?.(suggestion);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => {
          // Delay so a suggestion's onMouseDown fires before the dropdown
          // closes — a plain onClick would lose the race to blur.
          setTimeout(() => setOpen(false), 150);
          onBlur?.();
        }}
        placeholder={placeholder}
        className={className ?? "border border-gray-200 rounded-lg p-2.5 text-sm w-full"}
        autoComplete="off"
      />
      {open && (suggestions.length > 0 || loading) && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          {loading && suggestions.length === 0 && (
            <p className="text-xs text-gray-400 px-3 py-2">Searching…</p>
          )}
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => handleSelect(s)}
              className="block w-full text-left text-sm px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
            >
              {s.formattedAddress}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
