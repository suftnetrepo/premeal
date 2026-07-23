import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, isFailure } from "@/lib/admin-auth";
import { rejectRestaurant, NotFoundError } from "@/lib/admin";
import { unexpectedErrorResponse } from "@/lib/api-errors";

const schema = z.object({ note: z.string().min(1) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (isFailure(result)) return result.error;
  const { id } = await params;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A reason is required" }, { status: 400 });
  }

  try {
    const restaurant = await rejectRestaurant(id, parsed.data.note);
    return NextResponse.json({ restaurant });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return unexpectedErrorResponse(err, "Could not reject restaurant");
  }
}
