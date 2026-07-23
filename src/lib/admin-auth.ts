import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import type { User } from "@prisma/client";

type Success = { user: User };
type Failure = { error: NextResponse };

export async function requireAdmin(): Promise<Success | Failure> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Not authorized" }, { status: 401 }) };
  }
  return { user };
}

export function isFailure(result: Success | Failure): result is Failure {
  return "error" in result;
}
