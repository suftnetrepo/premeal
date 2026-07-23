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

export class InvalidUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUploadError";
  }
}

/** Uploads a menu-item photo to Cloudinary, returns its public HTTPS URL. */
export async function uploadMenuItemImage(file: File): Promise<string> {
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

  return result.secure_url;
}

/**
 * Uploads a restaurant's own profile/cover photo — shown as the card
 * header on the homepage and restaurant page. Cropped wide (fill, not
 * limit) rather than the menu item's square crop, since it's always
 * displayed as a banner, not a thumbnail — a portrait photo would
 * otherwise get badly letterboxed by the card layout.
 */
export async function uploadRestaurantProfileImage(file: File): Promise<string> {
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

  return result.secure_url;
}
