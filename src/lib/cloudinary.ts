import { v2 as cloudinary } from "cloudinary";

export class CloudinaryNotConfiguredError extends Error {
  constructor() {
    super(
      "Image upload isn't configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to your .env — free tier at https://cloudinary.com/users/register/free"
    );
    this.name = "CloudinaryNotConfiguredError";
  }
}

function ensureConfigured() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new CloudinaryNotConfiguredError();
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
// Food safety documents specifically: everything menu/profile photos
// accept, plus PDF — a local-authority registration confirmation is just
// as likely to be a scanned PDF as a phone photo.
const FOOD_SAFETY_ALLOWED_MIME_TYPES = [...ALLOWED_MIME_TYPES, "application/pdf"];

export class InvalidUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUploadError";
  }
}

export type CloudinaryUploadResult = {
  url: string;
  // Cloudinary's own asset identifier — the only thing its delete API
  // (see deleteCloudinaryImage below) actually accepts. Callers must
  // persist this alongside the URL if they ever want to clean the asset
  // up later; there's no reliable way to recover it from the URL alone.
  publicId: string;
};

/** Uploads a menu-item photo to Cloudinary, returns its URL and public_id. */
export async function uploadMenuItemImage(file: File): Promise<CloudinaryUploadResult> {
  ensureConfigured();

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new InvalidUploadError("Only JPEG, PNG, WebP, or GIF images are allowed.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new InvalidUploadError("Image is too large — max 5MB.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const dataUri = `data:${file.type};base64,${base64}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "premeal/menu-items",
    // Keeps images from becoming enormous page-weight without the
    // restaurant owner needing to think about image sizing at all.
    transformation: [{ width: 800, height: 800, crop: "limit", quality: "auto" }],
  });

  return { url: result.secure_url, publicId: result.public_id };
}

/**
 * Uploads a restaurant's own profile/cover photo — shown as the card
 * header on the homepage and restaurant page. Cropped wide (fill, not
 * limit) rather than the menu item's square crop, since it's always
 * displayed as a banner, not a thumbnail — a portrait photo would
 * otherwise get badly letterboxed by the card layout.
 */
export async function uploadRestaurantProfileImage(file: File): Promise<CloudinaryUploadResult> {
  ensureConfigured();

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new InvalidUploadError("Only JPEG, PNG, WebP, or GIF images are allowed.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new InvalidUploadError("Image is too large — max 5MB.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const dataUri = `data:${file.type};base64,${base64}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "premeal/restaurant-profiles",
    transformation: [{ width: 800, height: 450, crop: "fill", gravity: "auto", quality: "auto" }],
  });

  return { url: result.secure_url, publicId: result.public_id };
}

/**
 * Shared by every "PDF-or-image document" upload (as opposed to the
 * display-photo uploads above, which each have their own crop/resize
 * transformation). No transformation here: these are real documents, so
 * they're stored exactly as submitted. `resource_type: "auto"` lets
 * Cloudinary classify each one correctly whether it's actually an image
 * or a PDF — verified directly (real upload-then-delete test) that a
 * PDF uploaded this way still comes back as Cloudinary's "image"
 * resource type, the same type deleteCloudinaryImage() already assumes,
 * so no separate resource_type bookkeeping is needed to delete it later.
 */
async function uploadDocument(file: File, folder: string): Promise<CloudinaryUploadResult> {
  ensureConfigured();

  if (!FOOD_SAFETY_ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new InvalidUploadError("Only a PDF, JPEG, PNG, WebP, or GIF is allowed.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new InvalidUploadError("File is too large — max 5MB.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const dataUri = `data:${file.type};base64,${base64}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: "auto",
  });

  return { url: result.secure_url, publicId: result.public_id };
}

/**
 * Uploads a restaurant's local-authority food business registration
 * confirmation — a PDF or a photo of the confirmation, either is fine.
 * Mandatory, private (see /restaurant/food-safety) — not to be confused
 * with uploadHygieneCertificateDocument below, which is optional and
 * customer-visible once verified.
 */
export async function uploadFoodSafetyDocument(file: File): Promise<CloudinaryUploadResult> {
  return uploadDocument(file, "premeal/food-safety-documents");
}

/**
 * Uploads a restaurant's food hygiene rating certificate (or proof of
 * one) — optional, customer-visible once admin verifies it (see
 * /restaurant/location and /admin/hygiene-certificates). Same validation
 * and Cloudinary handling as uploadFoodSafetyDocument, just a separate
 * folder — kept as its own named export (a thin wrapper, not the same
 * function reused directly) so each asset type stays easy to find in
 * Cloudinary by folder, matching every other upload function here.
 */
export async function uploadHygieneCertificateDocument(file: File): Promise<CloudinaryUploadResult> {
  return uploadDocument(file, "premeal/hygiene-certificates");
}

/**
 * Deletes a Cloudinary asset by its public_id. Best-effort by design —
 * every call site treats a rejection here as log-and-continue, never as
 * a reason to fail the request it's cleaning up after. By the time this
 * runs, the DB write it's tidying up behind has already succeeded, so a
 * failed delete just leaves one more orphaned asset (the same state the
 * whole pre-existing backlog is already in) rather than corrupting
 * anything or blocking the user's actual action.
 *
 * Only ever call this with a publicId read back from the DB's own
 * cloudinaryPublicId column (itself only ever populated from a prior
 * upload's real response) — never one parsed or guessed from a URL.
 */
export async function deleteCloudinaryImage(publicId: string): Promise<void> {
  ensureConfigured();
  await cloudinary.uploader.destroy(publicId);
}
