import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, isFailure } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

const schema = z.object({ enabled: z.boolean() });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (isFailure(result)) return result.error;
  const { id } = await params;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "enabled is required" }, { status: 400 });
  }

  const flag = await prisma.featureFlag.update({
    where: { id },
    data: { enabled: parsed.data.enabled },
  });
  return NextResponse.json({ flag });
}
