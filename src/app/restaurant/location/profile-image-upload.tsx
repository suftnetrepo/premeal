"use client";

import { useState, useRef } from "react";
import { ImagePlus } from "lucide-react";

export function ProfileImageUpload({
  initialUrl,
  onUploaded,
}: {
  initialUrl: string | null;
  onUploaded?: (url: string) => void;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/restaurant/upload-profile-image", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not upload image");
      setUploading(false);
      return;
    }
    setUrl(data.url);
    onUploaded?.(data.url);
    setUploading(false);
  }

  return (
    <div className="mb-8">
      <p className="text-xs text-stone-500 mb-2">
        Restaurant photo
        <span className="text-stone-400"> — shown on your card everywhere customers browse</span>
      </p>
      <div
        onClick={() => inputRef.current?.click()}
        className="w-full max-w-sm h-40 rounded-xl border border-dashed border-stone-300 bg-stone-50 flex items-center justify-center cursor-pointer overflow-hidden relative group"
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Restaurant" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-stone-400">
            <ImagePlus size={22} strokeWidth={1.5} />
            <span className="text-xs">Click to upload</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-xs text-stone-600">
            Uploading…
          </div>
        )}
        {url && !uploading && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <span className="text-white text-xs font-medium">Change photo</span>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
