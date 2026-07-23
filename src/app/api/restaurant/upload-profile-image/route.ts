import { NextResponse } from "next/server";
import { requireOwnedRestaurant, isFailure } from "@/lib/restaurant-auth";
import { uploadRestaurantProfileImage, CloudinaryNotConfiguredError, InvalidUploadError } from "@/lib/cloudinary";
import { prisma } from "@/lib/db";
import { unexpectedErrorResponse } from "@/lib/api-errors";

export async function POST(request: Request) {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  try {
    const url = await uploadRestaurantProfileImage(file);
    await prisma.restaurant.update({
      where: { id: result.restaurant.id },
      data: { imageUrl: url },
    });
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof CloudinaryNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof InvalidUploadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return unexpectedErrorResponse(err, "Could not upload image");
  }
}
