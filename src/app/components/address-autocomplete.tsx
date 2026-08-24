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

  const inputClassName = className ?? "border border-gray-200 rounded-lg p-2.5 text-sm w-full";
  // The suggestions dropdown should read as part of the same control as the
  // input, so it borrows the input's own corner radius instead of a radius
  // hardcoded here that could drift from whatever each call site passes in.
  const roundedMatch = inputClassName.match(/(?:^|\s)(rounded(?:-\w+)?)(?=\s|$)/);
  const roundedClass = roundedMatch ? roundedMatch[1] : "rounded-lg";

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
        // The browser's default focus outline is a plain rectangle — it
        // doesn't follow the input's own rounded corners, so it renders as
        // a square blue box poking out past a rounded border. Swap it for a
        // ring, which does follow border-radius, on every call site.
        //
        // bg-white is forced on too: none of this component's callers set
        // their own background, and Tailwind's preflight makes inputs
        // transparent by default — over the hero photo that left the text
        // unreadable, so every instance gets an opaque background here
        // rather than each call site having to remember to add one.
        className={`${inputClassName} bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500`}
        autoComplete="off"
      />
      {open && (suggestions.length > 0 || loading) && (
        <div
          className={`absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 ${roundedClass} shadow-sm overflow-hidden`}
        >
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
