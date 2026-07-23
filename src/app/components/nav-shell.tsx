"use client";

import { useEffect, useState } from "react";

export function NavShell({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b transition-shadow duration-200 ${
        scrolled ? "border-transparent shadow-sm" : "border-stone-100"
      }`}
    >
      {children}
    </nav>
  );
}
