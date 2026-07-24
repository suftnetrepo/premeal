"use client";

import { useEffect, useState, useCallback } from "react";
import { Truck } from "lucide-react";

type DriverEntry = {
  id: string;
  email: string;
  status: "PENDING" | "ACTIVE" | "DECLINED" | "REMOVED";
  invitedAt: string;
  driver: { id: string; name: string; email: string } | null;
};

const statusStyles: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  ACTIVE: "bg-green-100 text-green-700",
  DECLINED: "bg-red-100 text-red-700",
};

export default function DriversPage() {
  const [drivers, setDrivers] = useState<DriverEntry[] | null>(null);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/restaurant/drivers");
    const data = await res.json();
    setDrivers(data.drivers ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleInvite() {
    setInviting(true);
    setError(null);
    const res = await fetch("/api/restaurant/drivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not invite driver");
      setInviting(false);
      return;
    }
    setEmail("");
    setInviting(false);
    load();
  }

  async function handleRemove(id: string) {
    setError(null);
    const res = await fetch(`/api/restaurant/drivers/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not remove driver");
      return;
    }
    load();
  }

  return (
    <main className="mx-auto max-w-2xl px-4 sm:px-6 py-10 w-full">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
          <Truck size={16} strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-black tracking-tight text-stone-900">Drivers</h1>
      </div>
      <p className="text-sm text-stone-500 mb-6">
        Invite people to deliver for you. A driver can work for more than one restaurant — if
        they already have a driver account, they&apos;ll need to accept your invite from their
        own dashboard before you can assign them any deliveries.
      </p>

      <div className="border border-stone-200 rounded-xl p-4 mb-6">
        <p className="text-sm font-medium mb-2">Invite a driver</p>
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="driver@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={handleInvite}
            disabled={!email.trim() || inviting}
            className="bg-orange-600 disabled:bg-stone-300 text-white rounded-lg px-4 py-2 text-sm font-medium"
          >
            {inviting ? "Sending…" : "Invite"}
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      <div className="flex flex-col gap-2">
        {drivers === null && <p className="text-sm text-stone-400">Loading…</p>}
        {drivers?.map((d) => (
          <div
            key={d.id}
            className="border border-stone-200 rounded-xl p-4 flex items-center justify-between"
          >
            <div>
              <p className="text-sm font-medium">{d.driver?.name ?? d.email}</p>
              <p className="text-xs text-stone-400">{d.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-0.5 rounded ${statusStyles[d.status] ?? "bg-stone-100 text-stone-600"}`}>
                {d.status === "PENDING" ? "Awaiting response" : d.status === "ACTIVE" ? "Active" : "Declined"}
              </span>
              <button onClick={() => handleRemove(d.id)} className="text-xs text-red-600">
                Remove
              </button>
            </div>
          </div>
        ))}
        {drivers?.length === 0 && <p className="text-sm text-stone-500">No drivers invited yet.</p>}
      </div>
    </main>
  );
}
