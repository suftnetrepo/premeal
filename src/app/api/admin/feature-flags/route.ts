import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, isFailure } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  key: z.string().min(1),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
});

export async function GET() {
  const result = await requireAdmin();
  if (isFailure(result)) return result.error;

  const flags = await prisma.featureFlag.findMany({ orderBy: { key: "asc" } });
  return NextResponse.json({ flags });
}

export async function POST(request: Request) {
  const result = await requireAdmin();
  if (isFailure(result)) return result.error;

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A key is required" }, { status: 400 });
  }

  try {
    const flag = await prisma.featureFlag.create({
      data: { ...parsed.data, key: parsed.data.key.trim() },
    });
    return NextResponse.json({ flag }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "A flag with that key already exists" }, { status: 409 });
  }
}
