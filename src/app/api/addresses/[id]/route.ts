import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { setDefaultAddress, deleteAddress } from "@/lib/addresses";
import { unexpectedErrorResponse } from "@/lib/api-errors";

const updateSchema = z.object({
  label: z.string().optional(),
  address: z.string().min(1).optional(),
  isDefault: z.boolean().optional(),
});

async function loadOwnedAddress(id: string, userId: string) {
  const address = await prisma.address.findUnique({ where: { id } });
  if (!address || address.userId !== userId) return null;
  return address;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  const { id } = await params;

  const existing = await loadOwnedAddress(id, user.id);
  if (!existing) return NextResponse.json({ error: "Address not found" }, { status: 404 });

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    if (parsed.data.isDefault) {
      await setDefaultAddress(id, user.id);
    }
    if (parsed.data.label !== undefined || parsed.data.address !== undefined) {
      await prisma.address.update({
        where: { id },
        data: {
          ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
          ...(parsed.data.address !== undefined ? { address: parsed.data.address } : {}),
        },
      });
    }
    const address = await prisma.address.findUnique({ where: { id } });
    return NextResponse.json({ address });
  } catch (err) {
    return unexpectedErrorResponse(err, "Could not update address");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  const { id } = await params;

  const existing = await loadOwnedAddress(id, user.id);
  if (!existing) return NextResponse.json({ error: "Address not found" }, { status: 404 });

  try {
    await deleteAddress(id, user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return unexpectedErrorResponse(err, "Could not remove address");
  }
}
