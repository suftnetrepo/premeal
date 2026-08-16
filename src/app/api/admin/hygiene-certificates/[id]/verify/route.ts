import { NextResponse } from "next/server";
import { requireAdmin, isFailure } from "@/lib/admin-auth";
import { verifyHygieneCertificate, NotFoundError, HygieneCertificateNotPendingError } from "@/lib/admin";
import { unexpectedErrorResponse } from "@/lib/api-errors";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (isFailure(result)) return result.error;
  const { id } = await params;

  try {
    const restaurant = await verifyHygieneCertificate(id);
    return NextResponse.json({ restaurant });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof HygieneCertificateNotPendingError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return unexpectedErrorResponse(err, "Could not verify certificate");
  }
}
