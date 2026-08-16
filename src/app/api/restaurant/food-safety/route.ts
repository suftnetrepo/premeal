import { NextResponse } from "next/server";
import { requireOwnedRestaurant, isFailure } from "@/lib/restaurant-auth";
import {
  uploadFoodSafetyDocument,
  deleteCloudinaryImage,
  CloudinaryNotConfiguredError,
  InvalidUploadError,
} from "@/lib/cloudinary";
import { prisma } from "@/lib/db";
import { unexpectedErrorResponse } from "@/lib/api-errors";

/**
 * The checkbox and the document are submitted together, always — there's
 * no path that sets foodSafetyAcknowledgedAt without also setting a real
 * document (or vice versa). That's deliberate: approveRestaurant() in
 * src/lib/admin.ts checks both, and keeping them written atomically here
 * means they can never legitimately drift out of sync.
 */
export async function POST(request: Request) {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;

  const formData = await request.formData();
  const file = formData.get("file");
  const acknowledged = formData.get("acknowledged");

  if (acknowledged !== "true") {
    return NextResponse.json(
      { error: "You need to confirm the checkbox before submitting." },
      { status: 400 }
    );
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Read before the upload/update below overwrites it — same
  // replace-then-clean-up-the-old-one pattern as the profile photo and
  // menu item image uploads.
  const previousPublicId = result.restaurant.foodSafetyDocumentPublicId;

  try {
    const { url, publicId } = await uploadFoodSafetyDocument(file);
    const restaurant = await prisma.restaurant.update({
      where: { id: result.restaurant.id },
      data: {
        foodSafetyDocumentUrl: url,
        foodSafetyDocumentPublicId: publicId,
        foodSafetyAcknowledgedAt: new Date(),
      },
    });

    if (previousPublicId) {
      deleteCloudinaryImage(previousPublicId).catch((err) => {
        console.warn(`[food-safety] Failed to delete old Cloudinary asset ${previousPublicId}:`, err);
      });
    }

    return NextResponse.json({ restaurant });
  } catch (err) {
    if (err instanceof CloudinaryNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof InvalidUploadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return unexpectedErrorResponse(err, "Could not save food safety compliance");
  }
}
