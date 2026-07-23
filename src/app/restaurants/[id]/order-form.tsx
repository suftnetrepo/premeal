"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, Plus, Minus, ShoppingBasket, CalendarDays, Clock, X } from "lucide-react";
import { formatMoney, formatDate } from "@/lib/format";
import { CheckoutPayment } from "./checkout-payment";
import { AddressPicker } from "./address-picker";

type ModifierOption = { id: string; name: string; priceDeltaCents: number };
type ModifierGroup = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: ModifierOption[];
};
type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number;
  categoryId: string | null;
  modifierGroups: ModifierGroup[];
};
type Category = { id: string; name: string };
const UNCATEGORIZED_TAB = "__uncategorized__";
type Slot = {
  id: string;
  date: string;
  windowStart: string;
  windowEnd: string;
  remaining: number;
  status: "available" | "limited" | "full";
};
type SessionUser = { id: string; name: string; email: string; role: string };
type Selection = { quantity: number; selectedOptionIds: string[] };

const statusStyles: Record<Slot["status"], string> = {
  available: "bg-green-100 text-green-700",
  limited: "bg-amber-100 text-amber-700",
  full: "bg-red-100 text-red-700",
};

const statusDotStyles: Record<Slot["status"], string> = {
  available: "bg-green-500",
  limited: "bg-amber-500",
  full: "bg-red-500",
};

const statusLabel: Record<Slot["status"], string> = {
  available: "Available",
  limited: "spots left",
  full: "Full",
};

function priceForSelection(item: MenuItem, selection: Selection | undefined): number {
  if (!selection) return item.priceCents;
  const allOptions = item.modifierGroups.flatMap((g) => g.options);
  const deltas = selection.selectedOptionIds.reduce((sum, id) => {
    const option = allOptions.find((o) => o.id === id);
    return sum + (option?.priceDeltaCents ?? 0);
  }, 0);
  return item.priceCents + deltas;
}

function isSelectionValid(item: MenuItem, selectedOptionIds: string[]): boolean {
  return item.modifierGroups.every((group) => {
    const count = group.options.filter((o) => selectedOptionIds.includes(o.id)).length;
    return count >= group.minSelect && count <= group.maxSelect;
  });
}

export function OrderForm({
  restaurantId,
  categories,
  menuItems,
  slots,
}: {
  restaurantId: string;
  categories: Category[];
  menuItems: MenuItem[];
  slots: Slot[];
}) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [customizingId, setCustomizingId] = useState<string | null>(null);
  const [draftOptionIds, setDraftOptionIds] = useState<string[]>([]);
  const [draftQty, setDraftQty] = useState(1);
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setUser(data.user));
  }, []);

  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discountCents: number; description: string | null } | null>(
    null
  );
  const [promoError, setPromoError] = useState<string | null>(null);
  const [checkingPromo, setCheckingPromo] = useState(false);

  const lineItems = Object.entries(selections)
    .filter(([, s]) => s.quantity > 0)
    .map(([menuItemId, s]) => ({ menuItemId, ...s }));

  const subtotalCents = lineItems.reduce((sum, s) => {
    const item = menuItems.find((m) => m.id === s.menuItemId);
    if (!item) return sum;
    return sum + priceForSelection(item, s) * s.quantity;
  }, 0);

  const readyForPayment = Boolean(selectedSlotId) && lineItems.length > 0 && Boolean(address);

  async function applyPromo() {
    if (!promoInput.trim()) return;
    setCheckingPromo(true);
    setPromoError(null);
    const res = await fetch("/api/checkout/validate-promo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: promoInput.trim(), restaurantId, subtotalCents }),
    });
    const data = await res.json();
    if (!res.ok) {
      setPromoError(typeof data.error === "string" ? data.error : "That code didn't work");
      setAppliedPromo(null);
      setCheckingPromo(false);
      return;
    }
    setAppliedPromo({ code: promoInput.trim().toUpperCase(), discountCents: data.discountCents, description: data.description });
    setCheckingPromo(false);
  }

  function removePromo() {
    setAppliedPromo(null);
    setPromoInput("");
    setPromoError(null);
  }

  function openCustomize(item: MenuItem) {
    setCustomizingId(item.id);
    setDraftOptionIds(selections[item.id]?.selectedOptionIds ?? []);
    setDraftQty(selections[item.id]?.quantity ?? 1);
  }

  function confirmCustomize(item: MenuItem) {
    if (!isSelectionValid(item, draftOptionIds)) return;
    setSelections((prev) => ({
      ...prev,
      [item.id]: {
        quantity: draftQty,
        selectedOptionIds: draftOptionIds,
      },
    }));
    setCustomizingId(null);
  }

  function setQty(item: MenuItem, qty: number) {
    if (qty > 0 && item.modifierGroups.length > 0 && !selections[item.id]) {
      openCustomize(item);
      return;
    }
    setSelections((prev) => ({
      ...prev,
      [item.id]: { selectedOptionIds: prev[item.id]?.selectedOptionIds ?? [], quantity: Math.max(0, qty) },
    }));
  }

  function toggleOption(group: ModifierGroup, optionId: string) {
    setDraftOptionIds((prev) => {
      const inGroupIds = group.options.map((o) => o.id);
      const withoutGroup = prev.filter((id) => !inGroupIds.includes(id));
      const alreadySelected = prev.includes(optionId);

      if (group.maxSelect === 1) {
        return alreadySelected ? withoutGroup : [...withoutGroup, optionId];
      }
      if (alreadySelected) return prev.filter((id) => id !== optionId);
      const currentInGroup = prev.filter((id) => inGroupIds.includes(id));
      if (currentInGroup.length >= group.maxSelect) return prev;
      return [...prev, optionId];
    });
  }

  async function handleSubmit(stripePaymentMethodId: string): Promise<boolean> {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          slotId: selectedSlotId,
          deliveryAddress: address,
          stripePaymentMethodId,
          promoCode: appliedPromo?.code,
          items: lineItems.map((s) => ({
            menuItemId: s.menuItemId,
            quantity: s.quantity,
            selectedOptionIds: s.selectedOptionIds,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.formErrors?.[0] ?? data.error ?? "Something went wrong");
        setSubmitting(false);
        return false;
      }
      router.push(`/orders/${data.order.id}`);
      return true;
    } catch {
      setError("Could not reach the server.");
      setSubmitting(false);
      return false;
    }
  }

  if (user === undefined) {
    return <p className="text-sm text-gray-400">Loading…</p>;
  }

  if (!user) {
    return (
      <div className="border border-stone-200 rounded-2xl p-8 text-center bg-white">
        <p className="text-sm text-stone-600 mb-3">Log in to order from this restaurant.</p>
        <Link href="/login" className="inline-block bg-orange-600 hover:bg-orange-700 transition-colors text-white rounded-full px-5 py-2.5 text-sm font-medium">
          Log in
        </Link>
        <p className="text-sm text-stone-400 mt-3">
          No account? <Link href="/signup" className="text-orange-600">Sign up</Link>
        </p>
      </div>
    );
  }

  const visibleItems = menuItems
    .filter((item) => {
      if (activeTab === "all") return true;
      if (activeTab === UNCATEGORIZED_TAB) return !item.categoryId;
      return item.categoryId === activeTab;
    })
    .filter((item) => {
      if (!query.trim()) return true;
      const q = query.trim().toLowerCase();
      return item.name.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q);
    });

  const activeSectionLabel =
    activeTab === "all"
      ? "All items"
      : activeTab === UNCATEGORIZED_TAB
        ? "Other"
        : categories.find((c) => c.id === activeTab)?.name ?? "Items";

  const selectedSlot = slots.find((s) => s.id === selectedSlotId);

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start">
      {/* ------------------------------------------------------------
          Menu browsing — left column
      ------------------------------------------------------------ */}
      <div className="flex-1 min-w-0 flex flex-col gap-6">
        <section>
          <h2 className="text-sm font-semibold text-stone-900 mb-3">Choose a delivery slot</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {slots.map((slot) => (
              <button
                key={slot.id}
                type="button"
                disabled={slot.status === "full"}
                onClick={() => setSelectedSlotId(slot.id)}
                className={`text-left border rounded-2xl p-4 transition-all duration-150 ${
                  selectedSlotId === slot.id
                    ? "border-orange-500 ring-1 ring-orange-500 bg-orange-50/40 shadow-sm"
                    : "border-stone-200 bg-white"
                } ${slot.status === "full" ? "opacity-50 cursor-not-allowed" : "hover:border-orange-300 hover:shadow-sm"}`}
              >
                <div className="flex items-center gap-1.5 text-stone-900">
                  <CalendarDays size={14} className="text-stone-400" strokeWidth={1.75} />
                  <p className="text-sm font-semibold">{formatDate(slot.date)}</p>
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-stone-500">
                  <Clock size={13} strokeWidth={1.75} />
                  <p className="text-xs">
                    {slot.windowStart}–{slot.windowEnd}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 mt-3 text-[11px] font-medium px-2 py-1 rounded-full ${statusStyles[slot.status]}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${statusDotStyles[slot.status]}`} />
                  {slot.status === "limited" ? `${slot.remaining} ${statusLabel[slot.status]}` : statusLabel[slot.status]}
                </span>
              </button>
            ))}
          </div>
        </section>

        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" strokeWidth={2} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the menu"
            className="w-full border border-stone-200 rounded-full pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400 focus:border-orange-400"
          />
        </div>

        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveTab("all")}
              className={`shrink-0 text-sm font-medium px-4 py-2 rounded-full transition-colors ${
                activeTab === "all" ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`shrink-0 text-sm font-medium px-4 py-2 rounded-full transition-colors ${
                  activeTab === cat.id ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                {cat.name}
              </button>
            ))}
            {menuItems.some((i) => !i.categoryId) && (
              <button
                onClick={() => setActiveTab(UNCATEGORIZED_TAB)}
                className={`shrink-0 text-sm font-medium px-4 py-2 rounded-full transition-colors ${
                  activeTab === UNCATEGORIZED_TAB ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                Other
              </button>
            )}
          </div>
        )}

        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-lg font-bold text-stone-900">{activeSectionLabel}</h3>
            <p className="text-sm text-stone-400">{visibleItems.length} item{visibleItems.length === 1 ? "" : "s"}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {visibleItems.map((item) => {
              const selection = selections[item.id];
              const qty = selection?.quantity ?? 0;
              const unitPrice = priceForSelection(item, selection);
              return (
                <div key={item.id} className="border border-stone-200 rounded-2xl overflow-hidden bg-white">
                  <div className="flex gap-3 p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-stone-900">{item.name}</p>
                      <p className="text-sm text-stone-500 mt-0.5">{formatMoney(unitPrice)}</p>
                      {item.description && (
                        <p className="text-xs text-stone-400 mt-1 line-clamp-2">{item.description}</p>
                      )}
                      {qty > 0 && item.modifierGroups.length > 0 && (
                        <button onClick={() => openCustomize(item)} className="text-xs text-orange-600 underline mt-1">
                          Edit choices
                        </button>
                      )}
                    </div>

                    <div className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-orange-50">
                      {item.imageUrl ? (
                        <Image src={item.imageUrl} alt={item.name} fill sizes="80px" className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl">🍽️</div>
                      )}
                      {qty === 0 ? (
                        <button
                          type="button"
                          onClick={() => setQty(item, 1)}
                          className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center text-orange-600 hover:bg-orange-50 transition-colors"
                          aria-label={`Add ${item.name}`}
                        >
                          <Plus size={16} strokeWidth={2.5} />
                        </button>
                      ) : (
                        <div className="absolute bottom-1 right-1 flex items-center gap-1 bg-white shadow-md rounded-full px-1 py-1">
                          <button
                            type="button"
                            onClick={() => setQty(item, qty - 1)}
                            className="w-5 h-5 rounded-full flex items-center justify-center text-stone-600"
                            aria-label={`Remove one ${item.name}`}
                          >
                            <Minus size={12} strokeWidth={2.5} />
                          </button>
                          <span className="text-xs font-semibold w-4 text-center">{qty}</span>
                          <button
                            type="button"
                            onClick={() => setQty(item, qty + 1)}
                            className="w-5 h-5 rounded-full flex items-center justify-center text-orange-600"
                            aria-label={`Add another ${item.name}`}
                          >
                            <Plus size={12} strokeWidth={2.5} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
            {visibleItems.length === 0 && (
              <p className="text-sm text-stone-400 sm:col-span-2">No items match your search.</p>
            )}
          </div>
        </section>
      </div>

      {/* Item customization modal — bottom sheet on mobile, centered card
          on larger screens. Replaces the old inline-in-card panel: with
          multiple modifier groups stacked, expanding in place got
          cramped. The quantity stepper lives inside the modal now too, so
          "Add £X.XX" commits quantity + selections in one action, with
          the button showing the real line total rather than a plain
          "Done" that didn't tell you what you were about to add. */}
      {customizingId && (() => {
        const item = menuItems.find((m) => m.id === customizingId);
        if (!item) return null;
        const valid = isSelectionValid(item, draftOptionIds);
        const lineTotal = priceForSelection(item, { quantity: draftQty, selectedOptionIds: draftOptionIds }) * draftQty;

        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setCustomizingId(null)}
              aria-hidden="true"
            />
            <div className="relative bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[85vh] overflow-y-auto">
              <div className="relative w-full h-48 bg-orange-50 sm:rounded-t-3xl overflow-hidden">
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt={item.name} fill sizes="448px" className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">🍽️</div>
                )}
                <button
                  type="button"
                  onClick={() => setCustomizingId(null)}
                  aria-label="Close"
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur flex items-center justify-center text-stone-700 hover:bg-white transition-colors"
                >
                  <X size={18} strokeWidth={2} />
                </button>
              </div>

              <div className="p-5">
                <p className="text-lg font-bold text-stone-900">{item.name}</p>
                <p className="text-sm text-stone-500 mt-0.5">{formatMoney(item.priceCents)}</p>
                {item.description && <p className="text-sm text-stone-400 mt-2">{item.description}</p>}

                <div className="flex flex-col gap-4 mt-5">
                  {item.modifierGroups.map((group) => (
                    <div key={group.id}>
                      <p className="text-sm font-medium text-stone-700 mb-2">
                        {group.name}{" "}
                        <span className="text-stone-400 font-normal">
                          {group.minSelect > 0
                            ? `(choose ${group.minSelect === group.maxSelect ? group.minSelect : `${group.minSelect}-${group.maxSelect}`})`
                            : "(optional)"}
                        </span>
                      </p>
                      <div className="flex flex-col gap-2">
                        {group.options.map((option) => (
                          <label
                            key={option.id}
                            className="flex items-center justify-between text-sm border border-stone-200 rounded-xl px-4 py-3 cursor-pointer has-[:checked]:border-orange-500 has-[:checked]:ring-1 has-[:checked]:ring-orange-500"
                          >
                            <span className="flex items-center gap-3">
                              <input
                                type={group.maxSelect === 1 ? "radio" : "checkbox"}
                                name={group.id}
                                checked={draftOptionIds.includes(option.id)}
                                onChange={() => toggleOption(group, option.id)}
                              />
                              {option.name}
                            </span>
                            {option.priceDeltaCents !== 0 && (
                              <span className="text-stone-500">
                                {option.priceDeltaCents > 0 ? "+" : ""}
                                {formatMoney(option.priceDeltaCents)}
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="sticky bottom-0 bg-white border-t border-stone-100 p-4 flex items-center gap-3">
                <div className="flex items-center gap-3 border border-stone-200 rounded-full px-3 py-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setDraftQty((q) => Math.max(1, q - 1))}
                    className="w-6 h-6 flex items-center justify-center text-stone-600"
                    aria-label="Decrease quantity"
                  >
                    <Minus size={14} strokeWidth={2.5} />
                  </button>
                  <span className="text-sm font-semibold w-4 text-center">{draftQty}</span>
                  <button
                    type="button"
                    onClick={() => setDraftQty((q) => q + 1)}
                    className="w-6 h-6 flex items-center justify-center text-orange-600"
                    aria-label="Increase quantity"
                  >
                    <Plus size={14} strokeWidth={2.5} />
                  </button>
                </div>
                <button
                  onClick={() => confirmCustomize(item)}
                  disabled={!valid}
                  className="flex-1 bg-orange-600 disabled:bg-stone-300 text-white rounded-full py-3 text-sm font-medium"
                >
                  Add {formatMoney(lineTotal)}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Order summary — sticky sidebar, matching the reference's
          persistent basket panel. Real cart contents and real fees only. */}
      <aside className="w-full lg:w-80 shrink-0 lg:sticky lg:top-20">
        <div className="border border-stone-200 rounded-2xl bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBasket size={18} className="text-orange-600" strokeWidth={1.75} />
            <h2 className="font-bold text-stone-900">Your order</h2>
          </div>

          {selectedSlot && (
            <div className="text-xs bg-orange-50 text-orange-800 rounded-lg px-3 py-2 mb-4">
              {formatDate(selectedSlot.date)}, {selectedSlot.windowStart}–{selectedSlot.windowEnd}
            </div>
          )}

          {lineItems.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingBasket size={28} className="text-stone-200 mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-sm font-medium text-stone-500">Your basket is empty</p>
              <p className="text-xs text-stone-400 mt-0.5">Add items from the menu to get started.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 mb-4 pb-4 border-b border-stone-100">
              {lineItems.map((li) => {
                const item = menuItems.find((m) => m.id === li.menuItemId);
                if (!item) return null;
                return (
                  <div key={li.menuItemId} className="flex justify-between text-sm gap-2">
                    <span className="text-stone-600">
                      {li.quantity}× {item.name}
                    </span>
                    <span className="text-stone-900 shrink-0">
                      {formatMoney(priceForSelection(item, li) * li.quantity)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {lineItems.length > 0 && (
            <>
              <div className="flex flex-col gap-2 mb-4">
                <h3 className="text-xs font-semibold text-stone-400 tracking-wide">DELIVERY DETAILS</h3>
                <p className="text-xs text-stone-500 -mt-1">
                  Ordering as {user.name} ({user.email})
                </p>
                <AddressPicker onChange={setAddress} />
              </div>

              <div className="flex flex-col gap-2 mb-4">
                <h3 className="text-xs font-semibold text-stone-400 tracking-wide">PROMO CODE</h3>
                {appliedPromo ? (
                  <div className="flex items-center justify-between border border-green-200 bg-green-50 rounded-lg p-3">
                    <div>
                      <p className="text-sm font-medium text-green-800">{appliedPromo.code}</p>
                      <p className="text-xs text-green-700">−{formatMoney(appliedPromo.discountCents)}</p>
                    </div>
                    <button onClick={removePromo} className="text-xs text-green-700 underline">
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value)}
                      placeholder="Enter code"
                      className="flex-1 border border-stone-200 rounded-lg p-2 text-sm min-w-0"
                    />
                    <button
                      onClick={applyPromo}
                      disabled={checkingPromo || !promoInput.trim()}
                      className="text-sm border border-stone-300 rounded-lg px-3 disabled:text-stone-300 shrink-0"
                    >
                      {checkingPromo ? "…" : "Apply"}
                    </button>
                  </div>
                )}
                {promoError && <p className="text-xs text-red-600">{promoError}</p>}
              </div>

              {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

              <div className="border-t border-stone-100 pt-4">
                <div className="flex flex-col gap-1 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <p className="text-stone-500">Subtotal</p>
                    <p className="text-stone-900">{formatMoney(subtotalCents)}</p>
                  </div>
                  {appliedPromo && (
                    <div className="flex items-center justify-between text-sm text-green-700">
                      <p>Discount ({appliedPromo.code})</p>
                      <p>−{formatMoney(appliedPromo.discountCents)}</p>
                    </div>
                  )}
                </div>

                {readyForPayment ? (
                  <CheckoutPayment
                    label={
                      submitting
                        ? "Placing order…"
                        : `Pay & place order — ${formatMoney(Math.max(0, subtotalCents - (appliedPromo?.discountCents ?? 0)))}`
                    }
                    disabled={submitting}
                    onPaymentMethod={handleSubmit}
                  />
                ) : (
                  <p className="text-xs text-stone-400 text-center border border-dashed border-stone-200 rounded-xl py-3">
                    {!selectedSlotId ? "Pick a delivery slot" : !address ? "Add a delivery address" : "Add items"} to pay
                  </p>
                )}
                <p className="text-xs text-stone-400 mt-3 text-center">
                  You won&apos;t be charged until the restaurant confirms, within 30 minutes.
                </p>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
