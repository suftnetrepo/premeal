import { NextResponse } from "next/server";
import { expireStaleOrders } from "@/lib/capacity";

// In production this route (or the function it calls) is triggered on a
// schedule — e.g. Vercel Cron hitting this endpoint every minute, or a
// worker process (see scripts/expire-orders-worker.ts). Nothing here should
// be called directly by the customer or restaurant apps.
export async function POST() {
  const expiredCount = await expireStaleOrders();
  return NextResponse.json({ expiredCount });
}
