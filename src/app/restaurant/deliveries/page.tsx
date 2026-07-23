"use client";

import { useEffect, useState, useCallback } from "react";
import { formatDate } from "@/lib/format";
import { CalendarDays } from "lucide-react";

type Slot = {
  id: string;
  date: string;
  windowStart: string;
  windowEnd: string;
  capacity: number;
  bookedCount: number;
  remaining: number;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function DeliveriesPage() {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [windowStart, setWindowStart] = useState("18:00");
  const [windowEnd, setWindowEnd] = useState("19:00");
  const [capacity, setCapacity] = useState("30");
  const [cutoffHour, setCutoffHour] = useState("15");
  const [daysAhead, setDaysAhead] = useState("14");
  const [weekdays, setWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const refresh = useCallback(async () => {
    const res = await fetch("/api/restaurant/slots");
    if (res.ok) setSlots((await res.json()).slots);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  function toggleWeekday(day: number) {
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  async function generate() {
    setGenerating(true);
    setMessage(null);
    const res = await fetch("/api/restaurant/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        windowStart,
        windowEnd,
        capacity: Number(capacity),
        cutoffHour: Number(cutoffHour),
        daysAhead: Number(daysAhead),
        weekdays,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage(`Created ${data.created} new day(s). ${data.skipped} already existed and were left as-is.`);
    } else {
      setMessage(data.error ?? "Something went wrong");
    }
    await refresh();
    setGenerating(false);
  }

  async function updateCapacity(slot: Slot) {
    const capacityNum = Number(editValue);
    const res = await fetch(`/api/restaurant/slots/${slot.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ capacity: capacityNum }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Could not update capacity");
    }
    setEditingId(null);
    await refresh();
  }

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-10 w-full">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
          <CalendarDays size={16} strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-black tracking-tight text-stone-900">Deliveries</h1>
      </div>
      <p className="text-sm text-stone-500 mb-8">
        Set your delivery window and capacity, then generate upcoming days at once.
      </p>

      <section className="mb-10 border border-stone-200 rounded-xl p-4">
        <h2 className="text-sm font-medium text-stone-500 mb-3">Generate a schedule</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <label className="text-xs text-stone-500">
            Window start
            <input
              type="time"
              value={windowStart}
              onChange={(e) => setWindowStart(e.target.value)}
              className="mt-1 w-full border border-stone-200 rounded-xl p-2 text-sm"
            />
          </label>
          <label className="text-xs text-stone-500">
            Window end
            <input
              type="time"
              value={windowEnd}
              onChange={(e) => setWindowEnd(e.target.value)}
              className="mt-1 w-full border border-stone-200 rounded-xl p-2 text-sm"
            />
          </label>
          <label className="text-xs text-stone-500">
            Capacity / day
            <input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="mt-1 w-full border border-stone-200 rounded-xl p-2 text-sm"
            />
          </label>
          <label className="text-xs text-stone-500">
            Cutoff (hour, 24h)
            <input
              type="number"
              min={0}
              max={23}
              value={cutoffHour}
              onChange={(e) => setCutoffHour(e.target.value)}
              className="mt-1 w-full border border-stone-200 rounded-xl p-2 text-sm"
            />
          </label>
        </div>

        <p className="text-xs text-stone-500 mb-2">Which days do you deliver?</p>
        <div className="flex gap-1 mb-3">
          {WEEKDAY_LABELS.map((label, day) => (
            <button
              key={day}
              onClick={() => toggleWeekday(day)}
              className={`text-xs px-2.5 py-1.5 rounded-xl border ${
                weekdays.includes(day)
                  ? "border-orange-500 bg-orange-50 text-orange-700"
                  : "border-stone-200 text-stone-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="text-xs text-stone-500 block mb-3">
          Generate how many days ahead?
          <input
            type="number"
            min={1}
            max={60}
            value={daysAhead}
            onChange={(e) => setDaysAhead(e.target.value)}
            className="mt-1 w-24 border border-stone-200 rounded-xl p-2 text-sm block"
          />
        </label>

        <button
          onClick={generate}
          disabled={generating}
          className="bg-orange-600 disabled:bg-stone-300 text-white rounded-xl px-4 py-2 text-sm"
        >
          {generating ? "Generating…" : "Generate schedule"}
        </button>
        {message && <p className="text-xs text-stone-500 mt-2">{message}</p>}
      </section>

      <section>
        <h2 className="text-sm font-medium text-stone-500 mb-3">Upcoming days</h2>
        {!slots && <p className="text-sm text-stone-400">Loading…</p>}
        {slots && slots.length === 0 && (
          <p className="text-sm text-stone-400">No delivery days set up yet — generate a schedule above.</p>
        )}
        <div className="flex flex-col gap-2">
          {slots?.map((slot) => (
            <div
              key={slot.id}
              className="flex items-center justify-between border border-stone-200 rounded-xl p-3"
            >
              <div>
                <p className="text-sm font-medium">{formatDate(slot.date)}</p>
                <p className="text-xs text-stone-500">
                  {slot.windowStart}–{slot.windowEnd} · {slot.bookedCount} booked
                </p>
              </div>
              {editingId === slot.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={slot.bookedCount}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-20 border border-stone-200 rounded-xl p-1.5 text-sm"
                  />
                  <button
                    onClick={() => updateCapacity(slot)}
                    className="text-xs bg-orange-600 text-white rounded-xl px-2 py-1.5"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditingId(slot.id);
                    setEditValue(String(slot.capacity));
                  }}
                  className="text-xs border border-stone-300 rounded-xl px-2 py-1.5"
                >
                  Capacity: {slot.capacity} ({slot.remaining} left)
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
