import { NextResponse } from "next/server";
import { requireAdmin, isFailure } from "@/lib/admin-auth";
import { approveRestaurant, NotFoundError } from "@/lib/admin";
import { unexpectedErrorResponse } from "@/lib/api-errors";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (isFailure(result)) return result.error;
  const { id } = await params;

  try {
    const restaurant = await approveRestaurant(id);
    return NextResponse.json({ restaurant });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return unexpectedErrorResponse(err, "Could not approve restaurant");
  }
}
