import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isFeatureEnabled, FEATURE_FLAGS } from "@/lib/feature-flags";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const subscription = await prisma.subscription.findUnique({ where: { userId: user.id } });
  const available = await isFeatureEnabled(FEATURE_FLAGS.SUBSCRIPTIONS);
  return NextResponse.json({ subscription, available });
}
