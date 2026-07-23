import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAddress } from "@/lib/addresses";
import { unexpectedErrorResponse } from "@/lib/api-errors";

const createSchema = z.object({
  address: z.string().min(1),
  label: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const addresses = await prisma.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ addresses });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid address is required" }, { status: 400 });
  }

  try {
    const address = await createAddress({ userId: user.id, ...parsed.data });
    return NextResponse.json({ address }, { status: 201 });
  } catch (err) {
    return unexpectedErrorResponse(err, "Could not save address");
  }
}
