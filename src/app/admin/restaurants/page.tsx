"use client";

import { useEffect, useState, useCallback } from "react";
import { Store, ShieldCheck, ShieldAlert, FileText } from "lucide-react";

type Restaurant = {
  id: string;
  name: string;
  cuisine: string;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  approvalNote: string | null;
  signupFeePaidAt: string | null;
  foodSafetyDocumentUrl: string | null;
  foodSafetyAcknowledgedAt: string | null;
  owner: { name: string; email: string };
  _count: { menuItems: number; deliverySlots: number };
};

const FILTERS = ["PENDING", "APPROVED", "REJECTED", "ALL"] as const;

export default function AdminRestaurantsPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("PENDING");
  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const qs = filter === "ALL" ? "" : `?status=${filter}`;
    const res = await fetch(`/api/admin/restaurants${qs}`);
    if (res.ok) setRestaurants((await res.json()).restaurants);
  }, [filter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function approve(id: string) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/admin/restaurants/${id}/approve`, { method: "POST" });
    if (!res.ok) {
      // Previously silent — a blocked approve (e.g. food safety
      // incomplete) would just no-op with zero indication why. The
      // Approve button is already disabled for that specific case below,
      // but this is the real enforcement; surfacing it here covers any
      // other reason the server-side check might reject it too.
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not approve");
      setBusyId(null);
      return;
    }
    setBusyId(null);
    await refresh();
  }

  async function reject(id: string) {
    if (!rejectNote.trim()) return;
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/admin/restaurants/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: rejectNote }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not reject");
      setBusyId(null);
      return;
    }
    setRejectingId(null);
    setRejectNote("");
    setBusyId(null);
    await refresh();
  }

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-10 w-full">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
          <Store size={16} strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-black tracking-tight text-stone-900">Restaurants</h1>
      </div>
      <p className="text-sm text-stone-500 mb-6">
        A restaurant needs your approval, on top of finishing their own menu and delivery setup, before customers
        can see them.
      </p>

      <div className="flex gap-2 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border ${
              filter === f ? "bg-stone-900 text-white border-stone-900" : "border-stone-200 text-stone-600"
            }`}
          >
            {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {restaurants === null && <p className="text-sm text-stone-400">Loading…</p>}
        {restaurants?.map((r) => (
          <div key={r.id} className="border border-stone-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="font-medium text-sm">{r.name}</p>
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  r.approvalStatus === "PENDING"
                    ? "bg-amber-100 text-amber-700"
                    : r.approvalStatus === "APPROVED"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                }`}
              >
                {r.approvalStatus}
              </span>
            </div>
            <p className="text-xs text-stone-500 mb-1">
              {r.cuisine} · {r.owner.name} ({r.owner.email})
            </p>
            <p className="text-xs text-stone-500 mb-3">
              {r._count.menuItems} menu items · {r._count.deliverySlots} delivery slots set up ·{" "}
              {r.signupFeePaidAt ? (
                <span className="text-green-700">signup fee paid</span>
              ) : (
                <span className="text-amber-700">signup fee unpaid</span>
              )}
            </p>

            {/* Deliberately its own block, above the approve/reject
                buttons rather than folded into the summary line above —
                this is the one thing that has to be checked before a
                decision, not just background context. */}
            <div
              className={`flex items-start gap-2 rounded-lg p-3 mb-3 text-xs ${
                r.foodSafetyDocumentUrl && r.foodSafetyAcknowledgedAt
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              {r.foodSafetyDocumentUrl && r.foodSafetyAcknowledgedAt ? (
                <ShieldCheck size={14} className="shrink-0 mt-0.5" strokeWidth={1.75} />
              ) : (
                <ShieldAlert size={14} className="shrink-0 mt-0.5" strokeWidth={1.75} />
              )}
              <div>
                {r.foodSafetyAcknowledgedAt ? (
                  <p>
                    Confirmed{" "}
                    {new Date(r.foodSafetyAcknowledgedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                ) : (
                  <p>Checkbox not confirmed yet</p>
                )}
                {r.foodSafetyDocumentUrl ? (
                  <a
                    href={r.foodSafetyDocumentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline"
                  >
                    <FileText size={12} strokeWidth={1.75} />
                    View food safety document
                  </a>
                ) : (
                  <p>No document uploaded yet</p>
                )}
              </div>
            </div>

            {r.approvalNote && r.approvalStatus === "REJECTED" && (
              <p className="text-xs text-red-600 mb-3">Rejected: {r.approvalNote}</p>
            )}

            {r.approvalStatus !== "APPROVED" && rejectingId !== r.id && (
              <div className="flex flex-col gap-2 items-start">
                <div className="flex gap-2">
                  <button
                    onClick={() => approve(r.id)}
                    disabled={busyId === r.id || !r.foodSafetyDocumentUrl || !r.foodSafetyAcknowledgedAt}
                    title={
                      !r.foodSafetyDocumentUrl || !r.foodSafetyAcknowledgedAt
                        ? "Can't approve until food safety compliance is complete"
                        : undefined
                    }
                    className="text-xs bg-orange-600 disabled:bg-stone-300 text-white rounded-xl px-3 py-1.5"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      setRejectingId(r.id);
                      setError(null);
                    }}
                    className="text-xs border border-red-200 text-red-600 rounded-xl px-3 py-1.5"
                  >
                    Reject
                  </button>
                </div>
                {error && <p className="text-xs text-red-600">{error}</p>}
              </div>
            )}

            {rejectingId === r.id && (
              <div className="flex flex-col gap-2">
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Reason (shown to the restaurant owner)"
                  className="border border-stone-200 rounded-xl p-2 text-sm resize-none"
                  rows={2}
                />
                {error && <p className="text-xs text-red-600">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setRejectingId(null);
                      setRejectNote("");
                    }}
                    className="text-xs border border-stone-300 rounded-xl px-3 py-1.5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => reject(r.id)}
                    disabled={busyId === r.id || !rejectNote.trim()}
                    className="text-xs bg-red-600 disabled:bg-stone-300 text-white rounded-xl px-3 py-1.5"
                  >
                    Confirm reject
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {restaurants?.length === 0 && <p className="text-sm text-stone-400">Nothing here.</p>}
      </div>
    </main>
  );
}
