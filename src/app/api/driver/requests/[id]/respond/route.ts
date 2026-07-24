import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDriver, isFailure } from "@/lib/driver-auth";
import { respondToDriverRequest, DriverError } from "@/lib/drivers";
import { unexpectedErrorResponse } from "@/lib/api-errors";

const schema = z.object({ accept: z.boolean() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireDriver();
  if (isFailure(result)) return result.error;

  const { id } = await params;
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    await respondToDriverRequest(result.user.id, id, parsed.data.accept);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DriverError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return unexpectedErrorResponse(err, "Could not respond to this request");
  }
}
