import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  currentPage,
  totalPages,
  buildHref,
}: {
  currentPage: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-6 pt-4 border-t border-stone-100">
      {currentPage > 1 ? (
        <Link
          href={buildHref(currentPage - 1)}
          className="flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900 transition-colors"
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
          Previous
        </Link>
      ) : (
        <span />
      )}

      <p className="text-sm text-stone-400">
        Page {currentPage} of {totalPages}
      </p>

      {currentPage < totalPages ? (
        <Link
          href={buildHref(currentPage + 1)}
          className="flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900 transition-colors"
        >
          Next
          <ChevronRight size={16} strokeWidth={1.75} />
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
