import { prisma } from "@/lib/db";
import { geocodeAddress } from "@/lib/geocoding";

export type CreateAddressInput = {
  userId: string;
  label?: string;
  address: string;
  isDefault?: boolean;
};

/**
 * Geocoding here is best-effort — an address that can't be geocoded (typo,
 * unusual format, geocoder hiccup) should still be saveable. Distance
 * features just won't have coordinates for it until it's re-saved or the
 * geocoder catches up; nothing about saving/using the address depends on
 * this succeeding.
 */
async function tryGeocode(address: string): Promise<{ latitude: number | null; longitude: number | null }> {
  try {
    const result = await geocodeAddress(address);
    return result ? { latitude: result.latitude, longitude: result.longitude } : { latitude: null, longitude: null };
  } catch {
    return { latitude: null, longitude: null };
  }
}

export async function createAddress(input: CreateAddressInput) {
  const trimmedAddress = input.address.trim();

  // The client-side "don't save twice" guard (see address-picker.tsx) only
  // survives a single typing session — it doesn't help across a page
  // reload, a remounted component, or (the actual case that surfaced this)
  // retrying checkout multiple times with the same address after a
  // rejected order. The real fix has to live here: if this user already
  // has this exact address saved, reuse it instead of creating a
  // near-identical duplicate every time.
  const existing = await prisma.address.findFirst({
    where: { userId: input.userId, address: { equals: trimmedAddress, mode: "insensitive" } },
  });
  if (existing) {
    if (input.isDefault && !existing.isDefault) {
      return setDefaultAddress(existing.id, input.userId);
    }
    return existing;
  }

  const existingCount = await prisma.address.count({ where: { userId: input.userId } });
  const shouldBeDefault = input.isDefault || existingCount === 0; // first address is always default

  const { latitude, longitude } = await tryGeocode(trimmedAddress);

  return prisma.$transaction(async (tx) => {
    if (shouldBeDefault) {
      await tx.address.updateMany({ where: { userId: input.userId }, data: { isDefault: false } });
    }
    return tx.address.create({
      data: {
        userId: input.userId,
        label: input.label,
        address: trimmedAddress,
        latitude,
        longitude,
        isDefault: shouldBeDefault,
      },
    });
  });
}

export async function setDefaultAddress(addressId: string, userId: string) {
  const address = await prisma.address.findUnique({ where: { id: addressId } });
  if (!address || address.userId !== userId) {
    throw new Error("Address not found");
  }

  return prisma.$transaction(async (tx) => {
    await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    return tx.address.update({ where: { id: addressId }, data: { isDefault: true } });
  });
}

/** If the deleted address was the default, promotes the most recently added remaining one. */
export async function deleteAddress(addressId: string, userId: string) {
  const address = await prisma.address.findUnique({ where: { id: addressId } });
  if (!address || address.userId !== userId) {
    throw new Error("Address not found");
  }

  await prisma.address.delete({ where: { id: addressId } });

  if (address.isDefault) {
    const nextDefault = await prisma.address.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    if (nextDefault) {
      await prisma.address.update({ where: { id: nextDefault.id }, data: { isDefault: true } });
    }
  }
}
