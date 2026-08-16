import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, isFailure } from "@/lib/admin-auth";
import { rejectHygieneCertificate, NotFoundError, HygieneCertificateNotPendingError } from "@/lib/admin";
import { unexpectedErrorResponse } from "@/lib/api-errors";

const schema = z.object({ reason: z.string().min(1) });

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
    const restaurant = await rejectHygieneCertificate(id, parsed.data.reason);
    return NextResponse.json({ restaurant });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof HygieneCertificateNotPendingError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return unexpectedErrorResponse(err, "Could not reject certificate");
  }
}
