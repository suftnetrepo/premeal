import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { previewPromoCode, PromoCodeError } from "@/lib/promotions";
import { unexpectedErrorResponse } from "@/lib/api-errors";

const schema = z.object({
  code: z.string().min(1),
  restaurantId: z.string(),
  subtotalCents: z.number().int().positive(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    const preview = await previewPromoCode({ ...parsed.data, customerId: user.id });
    return NextResponse.json(preview);
  } catch (err) {
    if (err instanceof PromoCodeError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return unexpectedErrorResponse(err, "Could not check that code");
  }
}
