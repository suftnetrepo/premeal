"use client";

import { useEffect, useState, useCallback } from "react";
import { formatMoney } from "@/lib/format";
import { Tag } from "lucide-react";

type PromoCode = {
  id: string;
  code: string;
  description: string | null;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  minOrderCents: number | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  isActive: boolean;
  restaurant: { name: string } | null;
};

export default function AdminPromotionsPage() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"PERCENTAGE" | "FIXED_AMOUNT">("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("10");
  const [minOrder, setMinOrder] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/promo-codes");
    if (res.ok) setPromoCodes((await res.json()).promoCodes);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function create() {
    if (!code.trim() || !discountValue) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/promo-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code.trim(),
        description: description.trim() || undefined,
        discountType,
        discountValue: discountType === "PERCENTAGE" ? Number(discountValue) : Math.round(Number(discountValue) * 100),
        minOrderCents: minOrder ? Math.round(Number(minOrder) * 100) : undefined,
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not create code");
      setSaving(false);
      return;
    }
    setCode("");
    setDescription("");
    setDiscountValue("10");
    setMinOrder("");
    setMaxRedemptions("");
    setCreating(false);
    setSaving(false);
    await refresh();
  }

  async function toggleActive(promo: PromoCode) {
    await fetch(`/api/admin/promo-codes/${promo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !promo.isActive }),
    });
    await refresh();
  }

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-10 w-full">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
          <Tag size={16} strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-black tracking-tight text-stone-900">Promotions</h1>
      </div>
      <p className="text-sm text-stone-500 mb-8">Discount codes, platform-wide.</p>

      <div className="flex flex-col gap-2 mb-8">
        {promoCodes === null && <p className="text-sm text-stone-400">Loading…</p>}
        {promoCodes?.map((p) => (
          <div key={p.id} className="border border-stone-200 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{p.code}</p>
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded ${
                    p.isActive ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-500"
                  }`}
                >
                  {p.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                {p.discountType === "PERCENTAGE" ? `${p.discountValue}% off` : `${formatMoney(p.discountValue)} off`}
                {p.minOrderCents && ` · min ${formatMoney(p.minOrderCents)}`}
                {" · "}
                {p.redemptionCount}
                {p.maxRedemptions ? ` / ${p.maxRedemptions}` : ""} used
              </p>
              {p.description && <p className="text-xs text-stone-400 mt-0.5">{p.description}</p>}
            </div>
            <button
              onClick={() => toggleActive(p)}
              className="text-xs border border-stone-300 rounded-xl px-2 py-1"
            >
              {p.isActive ? "Deactivate" : "Activate"}
            </button>
          </div>
        ))}
        {promoCodes?.length === 0 && <p className="text-sm text-stone-400">No promo codes yet.</p>}
      </div>

      {creating ? (
        <div className="border border-orange-200 bg-orange-50/40 rounded-xl p-4 flex flex-col gap-2 max-w-md">
          <input
            placeholder="CODE (e.g. WELCOME10)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="border border-stone-200 rounded-xl p-2 text-sm uppercase"
          />
          <input
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border border-stone-200 rounded-xl p-2 text-sm"
          />
          <div className="flex gap-2">
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as typeof discountType)}
              className="border border-stone-200 rounded-xl p-2 text-sm"
            >
              <option value="PERCENTAGE">% off</option>
              <option value="FIXED_AMOUNT">£ off</option>
            </select>
            <input
              placeholder={discountType === "PERCENTAGE" ? "e.g. 10" : "e.g. 5.00"}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              className="flex-1 border border-stone-200 rounded-xl p-2 text-sm"
              inputMode="decimal"
            />
          </div>
          <div className="flex gap-2">
            <input
              placeholder="Min order £ (optional)"
              value={minOrder}
              onChange={(e) => setMinOrder(e.target.value)}
              className="flex-1 border border-stone-200 rounded-xl p-2 text-sm"
              inputMode="decimal"
            />
            <input
              placeholder="Max total uses (optional)"
              value={maxRedemptions}
              onChange={(e) => setMaxRedemptions(e.target.value)}
              className="flex-1 border border-stone-200 rounded-xl p-2 text-sm"
              inputMode="numeric"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreating(false)} className="text-xs border border-stone-300 rounded-xl px-3 py-1.5">
              Cancel
            </button>
            <button
              onClick={create}
              disabled={saving}
              className="text-xs bg-orange-600 disabled:bg-stone-300 text-white rounded-xl px-3 py-1.5"
            >
              Create code
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setCreating(true)} className="text-sm text-orange-600">
          + New promo code
        </button>
      )}
    </main>
  );
}
