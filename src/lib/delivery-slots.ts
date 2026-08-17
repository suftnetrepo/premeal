/**
 * The one place that decides which of a restaurant's delivery slots are
 * actually shown to a customer and what each one's status is.
 *
 * Two independent constraints apply, and neither is assumed to cover the
 * other:
 *  - minimumLeadTimeDays (Restaurant-wide): a slot dated less than this
 *    many days from now is filtered out entirely, not shown greyed-out —
 *    a restaurant that needs a few days' notice doesn't want customers
 *    seeing an option they were never going to be allowed to pick.
 *  - cutoffAt (per-slot): unaffected by the above. A slot past its own
 *    cutoff is still shown, just marked "full" (pre-existing behavior) —
 *    "this filled up / closed" is a customer-understandable reason to see
 *    a slot that's no longer bookable, unlike the lead-time case above.
 *
 * Used by both the web restaurant page (src/app/restaurants/[id]/page.tsx)
 * and the /api/restaurants/[id] endpoint the mobile app calls, which
 * previously had their own separate copies of this exact filtering/status
 * logic — the same kind of drift risk src/lib/restaurant-listing.ts
 * already fixed once for "which restaurants are listable." Teaching
 * minimumLeadTimeDays to this one function means both callers picked it up
 * automatically instead of needing a matching fix twice.
 *
 * This only governs what's *displayed*. The real, can't-be-bypassed
 * enforcement is createOrder() in src/lib/capacity.ts, which re-checks
 * both constraints server-side against whatever slotId a client actually
 * sends — see earliestBookableSlotDate() below, shared by both.
 */

export function earliestBookableSlotDate(minimumLeadTimeDays: number): Date {
  // Same "local midnight of today" convention already used for the
  // pre-existing "today or later" slot query (see
  // src/app/restaurants/[id]/page.tsx / src/app/api/restaurants/[id]/route.ts)
  // — matched here rather than introduced fresh, so the two constraints
  // stay comparable against the same notion of "today."
  const date = new Date(new Date().toDateString());
  date.setDate(date.getDate() + minimumLeadTimeDays);
  return date;
}

export type SlotStatus = "available" | "limited" | "full";

type SlotLike = {
  date: Date;
  capacity: number;
  bookedCount: number;
  cutoffAt: Date;
};

export function getBookableSlots<T extends SlotLike>(
  slots: T[],
  minimumLeadTimeDays: number
): (T & { remaining: number; status: SlotStatus })[] {
  const earliestAllowedDate = earliestBookableSlotDate(minimumLeadTimeDays);

  return slots
    .filter((slot) => slot.date >= earliestAllowedDate)
    .map((slot) => {
      const remaining = slot.capacity - slot.bookedCount;
      const isPastCutoff = slot.cutoffAt < new Date();
      const status: SlotStatus = isPastCutoff || remaining <= 0 ? "full" : remaining <= 5 ? "limited" : "available";
      return { ...slot, remaining, status };
    });
}
