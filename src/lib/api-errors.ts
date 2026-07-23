import { NextResponse } from "next/server";

/**
 * Use in a route handler's catch block for genuinely unexpected errors
 * (not the specific typed errors like SlotFullError that already have
 * their own handling). Shows the real error in development so failures
 * are debuggable from the browser response alone, without needing
 * terminal/log access — but never leaks internals in production.
 */
export function unexpectedErrorResponse(err: unknown, fallbackMessage: string) {
  console.error(err);
  const detail = err instanceof Error ? err.message : String(err);
  return NextResponse.json(
    {
      error:
        process.env.NODE_ENV === "production" ? fallbackMessage : `${fallbackMessage}: ${detail}`,
    },
    { status: 500 }
  );
}
