import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOwnedRestaurant, isFailure } from "@/lib/restaurant-auth";
import { deleteCloudinaryImage } from "@/lib/cloudinary";

const updateItemSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  priceCents: z.number().int().positive().optional(),
  isAvailable: z.boolean().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  // Always sent alongside imageUrl by the menu editor (empty string when
  // there's no known Cloudinary asset for the current image — e.g. it was
  // set via the "paste a photo URL directly" field, not an upload). Kept
  // separate from imageUrl itself since the DB column names differ
  // (imageUrl vs cloudinaryPublicId) and this is never blindly spread
  // into the Prisma update below — see the imageUrl-provided branch.
  imagePublicId: z.string().optional().or(z.literal("")),
  categoryId: z.string().nullable().optional(),
});

async function loadOwnedItem(restaurantId: string, itemId: string) {
  const item = await prisma.menuItem.findUnique({ where: { id: itemId } });
  if (!item || item.restaurantId !== restaurantId) return null;
  return item;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;
  const { itemId } = await params;

  const existing = await loadOwnedItem(result.restaurant.id, itemId);
  if (!existing) {
    return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.categoryId) {
    const category = await prisma.menuCategory.findUnique({ where: { id: parsed.data.categoryId } });
    if (!category || category.restaurantId !== result.restaurant.id) {
      return NextResponse.json({ error: "That category doesn't belong to you" }, { status: 403 });
    }
  }

  // imagePublicId isn't a real Prisma column (it maps to
  // cloudinaryPublicId) — pulled out here so it's never blindly spread
  // into the update below, only ever set explicitly alongside imageUrl.
  const { imagePublicId, ...rest } = parsed.data;
  const newImageUrl = parsed.data.imageUrl !== undefined ? parsed.data.imageUrl || null : undefined;
  // Same non-enumerable-string comparison whether the image is being
  // replaced with a new one, cleared entirely, or swapped for a
  // manually-pasted URL — any of those means the *old* asset (if it had
  // a known public_id) is no longer referenced anywhere and should go.
  const imageIsChanging = newImageUrl !== undefined && newImageUrl !== existing.imageUrl;

  const item = await prisma.menuItem.update({
    where: { id: itemId },
    data: {
      ...rest,
      ...(newImageUrl !== undefined
        ? { imageUrl: newImageUrl, cloudinaryPublicId: imagePublicId || null }
        : {}),
    },
  });

  // Runs after the DB write succeeds, and never blocks the response — see
  // deleteCloudinaryImage()'s doc comment for why. Guarded on the OLD
  // item actually having a real public_id; a manually-pasted-URL image
  // (or anything from the pre-existing backlog) has none, and nothing
  // here ever tries to guess one from the URL instead.
  if (imageIsChanging && existing.cloudinaryPublicId) {
    deleteCloudinaryImage(existing.cloudinaryPublicId).catch((err) => {
      console.warn(`[menu/${itemId}] Failed to delete old Cloudinary asset ${existing.cloudinaryPublicId}:`, err);
    });
  }

  return NextResponse.json({ item });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;
  const { itemId } = await params;

  const existing = await loadOwnedItem(result.restaurant.id, itemId);
  if (!existing) {
    return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
  }

  // Menu items already referenced by past orders can't be hard-deleted
  // (OrderItem keeps a snapshot, but the foreign key still points here) —
  // mark unavailable instead, which is what customers should see anyway.
  const usedInOrders = await prisma.orderItem.findFirst({ where: { menuItemId: itemId } });
  if (usedInOrders) {
    const item = await prisma.menuItem.update({
      where: { id: itemId },
      data: { isAvailable: false },
    });
    return NextResponse.json({ item, note: "Item has past orders — marked unavailable instead of deleted." });
  }

  await prisma.menuItem.delete({ where: { id: itemId } });

  // Same ordering reasoning as the PATCH handler above: the row (the
  // only record of this asset's existence) is already gone from the DB
  // by this point, so a failed delete here just leaves one more orphan —
  // never a broken reference, and never something to fail this request
  // over. Guarded on a real public_id existing, same as PATCH.
  if (existing.cloudinaryPublicId) {
    deleteCloudinaryImage(existing.cloudinaryPublicId).catch((err) => {
      console.warn(`[menu/${itemId}] Failed to delete Cloudinary asset ${existing.cloudinaryPublicId} on item delete:`, err);
    });
  }

  return NextResponse.json({ ok: true });
}
