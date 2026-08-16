"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

const GOV_UK_URL = "https://www.gov.uk/guidance/starting-a-food-business";

export function FoodSafetyForm({
  initialDocumentUrl,
  initialAcknowledgedAt,
}: {
  initialDocumentUrl: string | null;
  initialAcknowledgedAt: string | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documentUrl, setDocumentUrl] = useState(initialDocumentUrl);
  const [acknowledgedAt, setAcknowledgedAt] = useState(initialAcknowledgedAt);
  const [checked, setChecked] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isComplete = Boolean(documentUrl && acknowledgedAt);

  async function submit() {
    const file = fileInputRef.current?.files?.[0];
    if (!checked || !file) return;

    setSubmitting(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("acknowledged", "true");

    const res = await fetch("/api/restaurant/food-safety", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not save this");
      setSubmitting(false);
      return;
    }
    setDocumentUrl(data.restaurant.foodSafetyDocumentUrl);
    setAcknowledgedAt(data.restaurant.foodSafetyAcknowledgedAt);
    setChecked(false);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSubmitting(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 max-w-md">
      {isComplete && (
        <div className="border border-green-200 bg-green-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={16} className="text-green-700 shrink-0" strokeWidth={1.75} />
            <p className="text-sm font-medium text-green-800">Compliance on file</p>
          </div>
          <p className="text-xs text-green-700">
            Confirmed {new Date(acknowledgedAt!).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} —{" "}
            <a href={documentUrl!} target="_blank" rel="noopener noreferrer" className="underline">
              view your uploaded document
            </a>
            .
          </p>
        </div>
      )}

      <div className="border border-stone-200 rounded-xl p-4 flex flex-col gap-3">
        <p className="text-sm font-medium text-stone-900">
          {isComplete ? "Replace your document" : "Confirm food safety compliance"}
        </p>

        <label className="flex items-start gap-2.5 text-sm text-stone-700 cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 shrink-0"
          />
          <span>
            I confirm I have registered my food business with my local authority, and I understand my legal
            obligations under UK food hygiene law. (
            <a href={GOV_UK_URL} target="_blank" rel="noopener noreferrer" className="text-orange-600 underline">
              What this actually means — gov.uk
            </a>
            )
          </span>
        </label>

        <div>
          <label className="text-xs text-stone-500">
            Local authority registration confirmation (PDF, JPEG, PNG, WebP, or GIF — max 5MB)
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              className="mt-1 block w-full text-sm text-stone-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-stone-200 file:bg-white file:text-sm file:text-stone-700"
            />
          </label>
          {fileName && <p className="text-xs text-stone-400 mt-1">Selected: {fileName}</p>}
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          onClick={submit}
          disabled={!checked || !fileName || submitting}
          className="bg-orange-600 disabled:bg-stone-300 text-white rounded-xl px-4 py-2.5 text-sm self-start"
        >
          {submitting ? "Uploading…" : isComplete ? "Replace document" : "Submit"}
        </button>
      </div>

      <p className="text-xs text-stone-400">
        Both the checkbox and a real document are required before your application can be approved — see{" "}
        <a href={GOV_UK_URL} target="_blank" rel="noopener noreferrer" className="underline">
          gov.uk&apos;s guidance on starting a food business
        </a>{" "}
        for what registering with your local authority actually involves.
      </p>
    </div>
  );
}
