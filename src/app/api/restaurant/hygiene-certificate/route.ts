import { NextResponse } from "next/server";
import { requireOwnedRestaurant, isFailure } from "@/lib/restaurant-auth";
import {
  uploadHygieneCertificateDocument,
  deleteCloudinaryImage,
  CloudinaryNotConfiguredError,
  InvalidUploadError,
} from "@/lib/cloudinary";
import { prisma } from "@/lib/db";
import { unexpectedErrorResponse } from "@/lib/api-errors";
import type { HygieneCertificateLevel } from "@prisma/client";

const VALID_LEVELS: HygieneCertificateLevel[] = ["LEVEL_1", "LEVEL_2", "LEVEL_3", "LEVEL_4"];

/**
 * Every submission — first-time or a resubmission after rejection (or
 * even replacing an already-verified one) — resets status back to
 * PENDING and clears verifiedAt. That's deliberate, not an oversight:
 * the customer-facing badge on the restaurant's public page reads
 * hygieneCertificateStatus directly, so this is what actually makes
 * "never shown until genuinely verified" hold even when someone
 * resubmits — the old verified state can't keep showing a badge for a
 * document that's no longer the one on file.
 */
export async function POST(request: Request) {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;

  const formData = await request.formData();
  const file = formData.get("file");
  const level = formData.get("level");

  if (typeof level !== "string" || !VALID_LEVELS.includes(level as HygieneCertificateLevel)) {
    return NextResponse.json({ error: "Choose a valid certificate level" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const previousPublicId = result.restaurant.hygieneCertificateDocumentPublicId;

  try {
    const { url, publicId } = await uploadHygieneCertificateDocument(file);
    const restaurant = await prisma.restaurant.update({
      where: { id: result.restaurant.id },
      data: {
        hygieneCertificateLevel: level as HygieneCertificateLevel,
        hygieneCertificateDocumentUrl: url,
        hygieneCertificateDocumentPublicId: publicId,
        hygieneCertificateStatus: "PENDING",
        hygieneCertificateSubmittedAt: new Date(),
        hygieneCertificateVerifiedAt: null,
        hygieneCertificateRejectionReason: null,
      },
    });

    if (previousPublicId) {
      deleteCloudinaryImage(previousPublicId).catch((err) => {
        console.warn(`[hygiene-certificate] Failed to delete old Cloudinary asset ${previousPublicId}:`, err);
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
    return unexpectedErrorResponse(err, "Could not submit hygiene certificate");
  }
}
