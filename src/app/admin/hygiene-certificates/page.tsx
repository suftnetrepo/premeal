"use client";

import { useEffect, useState, useCallback } from "react";
import { Award, FileText } from "lucide-react";

type Restaurant = {
  id: string;
  name: string;
  hygieneCertificateLevel: "LEVEL_1" | "LEVEL_2" | "LEVEL_3" | "LEVEL_4";
  hygieneCertificateDocumentUrl: string;
  hygieneCertificateStatus: "PENDING" | "VERIFIED" | "REJECTED";
  hygieneCertificateSubmittedAt: string;
  hygieneCertificateRejectionReason: string | null;
  owner: { name: string; email: string };
};

const FILTERS = ["PENDING", "VERIFIED", "REJECTED", "ALL"] as const;

const LEVEL_LABELS: Record<Restaurant["hygieneCertificateLevel"], string> = {
  LEVEL_1: "Level 1 — Introduction",
  LEVEL_2: "Level 2 — Food Handlers",
  LEVEL_3: "Level 3 — Supervisory",
  LEVEL_4: "Level 4 — Managerial",
};

export default function AdminHygieneCertificatesPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("PENDING");
  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const qs = filter === "ALL" ? "" : `?status=${filter}`;
    const res = await fetch(`/api/admin/hygiene-certificates${qs}`);
    if (res.ok) setRestaurants((await res.json()).restaurants);
  }, [filter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function verify(id: string) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/admin/hygiene-certificates/${id}/verify`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not verify");
      setBusyId(null);
      return;
    }
    setBusyId(null);
    await refresh();
  }

  async function reject(id: string) {
    if (!rejectReason.trim()) return;
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/admin/hygiene-certificates/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not reject");
      setBusyId(null);
      return;
    }
    setRejectingId(null);
    setRejectReason("");
    setBusyId(null);
    await refresh();
  }

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-10 w-full">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
          <Award size={16} strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-black tracking-tight text-stone-900">Hygiene certificates</h1>
      </div>
      <p className="text-sm text-stone-500 mb-6">
        Optional, customer-visible trust badges — separate from restaurant approval. A restaurant can submit
        one at any point, not just during onboarding, so this queue isn&apos;t limited to new signups.
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
                  r.hygieneCertificateStatus === "PENDING"
                    ? "bg-amber-100 text-amber-700"
                    : r.hygieneCertificateStatus === "VERIFIED"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                }`}
              >
                {r.hygieneCertificateStatus}
              </span>
            </div>
            <p className="text-xs text-stone-500 mb-1">
              {r.owner.name} ({r.owner.email})
            </p>
            <p className="text-xs text-stone-500 mb-3">
              Claimed: <span className="font-medium text-stone-700">{LEVEL_LABELS[r.hygieneCertificateLevel]}</span>{" "}
              · submitted {new Date(r.hygieneCertificateSubmittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </p>
            <a
              href={r.hygieneCertificateDocumentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-orange-600 underline mb-3"
            >
              <FileText size={12} strokeWidth={1.75} />
              View submitted document
            </a>

            {r.hygieneCertificateRejectionReason && r.hygieneCertificateStatus === "REJECTED" && (
              <p className="text-xs text-red-600 mb-3">Rejected: {r.hygieneCertificateRejectionReason}</p>
            )}

            {r.hygieneCertificateStatus === "PENDING" && rejectingId !== r.id && (
              <div className="flex flex-col gap-2 items-start">
                <div className="flex gap-2">
                  <button
                    onClick={() => verify(r.id)}
                    disabled={busyId === r.id}
                    className="text-xs bg-orange-600 disabled:bg-stone-300 text-white rounded-xl px-3 py-1.5"
                  >
                    Verify
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
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason (shown to the restaurant owner)"
                  className="border border-stone-200 rounded-xl p-2 text-sm resize-none"
                  rows={2}
                />
                {error && <p className="text-xs text-red-600">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setRejectingId(null);
                      setRejectReason("");
                    }}
                    className="text-xs border border-stone-300 rounded-xl px-3 py-1.5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => reject(r.id)}
                    disabled={busyId === r.id || !rejectReason.trim()}
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
