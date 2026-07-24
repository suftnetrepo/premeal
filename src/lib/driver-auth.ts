import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import type { User } from "@prisma/client";

type Success = { user: User };
type Failure = { error: NextResponse };

/** Every /api/driver/* route needs the same check: is someone logged in as a DRIVER. */
export async function requireDriver(): Promise<Success | Failure> {
  const user = await getCurrentUser();
  if (!user || user.role !== "DRIVER") {
    return { error: NextResponse.json({ error: "Not authorized" }, { status: 401 }) };
  }
  return { user };
}

export function isFailure(result: Success | Failure): result is Failure {
  return "error" in result;
}
