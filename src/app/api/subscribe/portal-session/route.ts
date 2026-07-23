import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createBillingPortalSession } from "@/lib/subscriptions";
import { unexpectedErrorResponse } from "@/lib/api-errors";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  try {
    const url = await createBillingPortalSession(user);
    return NextResponse.json({ url });
  } catch (err) {
    return unexpectedErrorResponse(err, "Could not open the billing portal");
  }
}
