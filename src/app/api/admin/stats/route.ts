import { NextResponse } from "next/server";
import { requireAdmin, isFailure } from "@/lib/admin-auth";
import { getOverviewStats } from "@/lib/admin";
import { unexpectedErrorResponse } from "@/lib/api-errors";

export async function GET() {
  const result = await requireAdmin();
  if (isFailure(result)) return result.error;

  try {
    const stats = await getOverviewStats();
    return NextResponse.json(stats);
  } catch (err) {
    return unexpectedErrorResponse(err, "Could not load stats");
  }
}
