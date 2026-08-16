"use client";

import { useRef, useState } from "react";
import { Award } from "lucide-react";

type Level = "LEVEL_1" | "LEVEL_2" | "LEVEL_3" | "LEVEL_4";
type Status = "PENDING" | "VERIFIED" | "REJECTED";

const LEVEL_OPTIONS: { value: Level; label: string }[] = [
  { value: "LEVEL_1", label: "Level 1 — Introduction" },
  { value: "LEVEL_2", label: "Level 2 — Food Handlers" },
  { value: "LEVEL_3", label: "Level 3 — Supervisory" },
  { value: "LEVEL_4", label: "Level 4 — Managerial" },
];

export function HygieneCertificateSection({
  initialLevel,
  initialDocumentUrl,
  initialStatus,
  initialSubmittedAt,
  initialRejectionReason,
}: {
  initialLevel: Level | null;
  initialDocumentUrl: string | null;
  initialStatus: Status | null;
  initialSubmittedAt: string | null;
  initialRejectionReason: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [level, setLevel] = useState<Level>(initialLevel ?? "LEVEL_2");
  const [documentUrl, setDocumentUrl] = useState(initialDocumentUrl);
  const [status, setStatus] = useState(initialStatus);
  const [submittedAt, setSubmittedAt] = useState(initialSubmittedAt);
  const [rejectionReason, setRejectionReason] = useState(initialRejectionReason);
  const [showForm, setShowForm] = useState(initialStatus === null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setSubmitting(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("level", level);

    const res = await fetch("/api/restaurant/hygiene-certificate", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not submit this");
      setSubmitting(false);
      return;
    }
    setDocumentUrl(data.restaurant.hygieneCertificateDocumentUrl);
    setStatus(data.restaurant.hygieneCertificateStatus);
    setSubmittedAt(data.restaurant.hygieneCertificateSubmittedAt);
    setRejectionReason(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setShowForm(false);
    setSubmitting(false);
  }

  return (
    <div className="border-t border-stone-100 mt-3 pt-5">
      <div className="flex items-center gap-2 mb-1">
        <Award size={15} className="text-orange-600" strokeWidth={1.75} />
        <p className="text-sm font-medium text-stone-900">Food hygiene certificate</p>
        <span className="text-[10px] uppercase tracking-wide text-stone-400 border border-stone-200 rounded-full px-1.5 py-0.5">
          Optional
        </span>
      </div>
      <p className="text-xs text-stone-500 mb-3">
        A real trust signal shown to customers on your public page — not required, and not part of getting
        approved. Only shows once we&apos;ve verified it.
      </p>

      {status && !showForm && (
        <div
          className={`rounded-xl p-3 mb-3 text-xs ${
            status === "VERIFIED"
              ? "bg-green-50 text-green-800"
              : status === "PENDING"
                ? "bg-amber-50 text-amber-800"
                : "bg-red-50 text-red-800"
          }`}
        >
          {status === "VERIFIED" && (
            <p>
              Verified — showing on your public page now.{" "}
              {documentUrl && (
                <a href={documentUrl} target="_blank" rel="noopener noreferrer" className="underline">
                  View document
                </a>
              )}
            </p>
          )}
          {status === "PENDING" && (
            <p>
              Submitted {submittedAt && new Date(submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} — awaiting review. Nothing shows on your public page until it&apos;s verified.
            </p>
          )}
          {status === "REJECTED" && (
            <>
              <p className="font-medium mb-1">Not verified{rejectionReason ? " — here's why:" : "."}</p>
              {rejectionReason && <p>{rejectionReason}</p>}
            </>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="mt-2 text-xs underline"
          >
            {status === "REJECTED" ? "Fix and resubmit" : "Replace document"}
          </button>
        </div>
      )}

      {showForm && (
        <div className="flex flex-col gap-2 max-w-sm">
          <label className="text-xs text-stone-500">
            Certificate level
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as Level)}
              className="mt-1 w-full border border-stone-200 rounded-xl p-2.5 text-sm"
            >
              {LEVEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-stone-500">
            Certificate document (PDF, JPEG, PNG, WebP, or GIF — max 5MB)
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              className="mt-1 block w-full text-sm text-stone-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-stone-200 file:bg-white file:text-sm file:text-stone-700"
            />
          </label>
          {fileName && <p className="text-xs text-stone-400">Selected: {fileName}</p>}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={!fileName || submitting}
              className="bg-orange-600 disabled:bg-stone-300 text-white rounded-xl px-4 py-2 text-sm self-start"
            >
              {submitting ? "Uploading…" : "Submit"}
            </button>
            {status && (
              <button
                onClick={() => {
                  setShowForm(false);
                  setError(null);
                }}
                className="text-sm text-stone-500 px-2"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
