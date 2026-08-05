import { NextResponse } from "next/server";
import { requireOwnedRestaurant, isFailure } from "@/lib/restaurant-auth";
import {
  uploadRestaurantProfileImage,
  deleteCloudinaryImage,
  CloudinaryNotConfiguredError,
  InvalidUploadError,
} from "@/lib/cloudinary";
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

  // Read before the upload/update below overwrites it — this is the
  // asset (if any) that's about to become orphaned.
  const previousPublicId = result.restaurant.cloudinaryPublicId;

  try {
    const { url, publicId } = await uploadRestaurantProfileImage(file);
    await prisma.restaurant.update({
      where: { id: result.restaurant.id },
      data: { imageUrl: url, cloudinaryPublicId: publicId },
    });

    // DB already points at the new image by this point — deleting the
    // old one is cleanup, not something that can leave the DB in a
    // broken state if it fails. Best-effort, never blocks the response.
    if (previousPublicId) {
      deleteCloudinaryImage(previousPublicId).catch((err) => {
        console.warn(`[upload-profile-image] Failed to delete old Cloudinary asset ${previousPublicId}:`, err);
      });
    }

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
