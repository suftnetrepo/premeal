/**
 * Adds Mama Kaya's Kitchen (West African) and Delhi Spice House (Indian)
 * as two more fully-approved, ready-to-order demo restaurants —
 * deliberately additive-only, unlike prisma/seed.ts which wipes
 * everything first. Written specifically so this is safe to run against
 * an environment (like Render) that already has real data on it —
 * driver invites you've actually sent, orders actually placed — that a
 * full reseed would otherwise destroy.
 *
 * Safe to run more than once: if either restaurant's owner email already
 * exists, that restaurant is skipped rather than erroring on a duplicate
 * unique constraint.
 *
 * Usage: npx tsx scripts/seed-additional-restaurants.ts
 */
import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";

const DEMO_PASSWORD = "password123";

function dateAtMidnight(daysFromNow: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(0, 0, 0, 0);
  return d;
}

function cutoffFor(date: Date, hour: number): Date {
  const cutoff = new Date(date);
  cutoff.setHours(hour, 0, 0, 0);
  return cutoff;
}

async function seedRestaurantIfMissing(config: {
  ownerEmail: string;
  ownerName: string;
  restaurantName: string;
  slug: string;
  cuisine: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  deliveryRadiusKm: number;
  menuItems: Parameters<typeof prisma.restaurant.create>[0]["data"]["menuItems"];
  slotWindow: { start: string; end: string; capacity: number };
}) {
  const existing = await prisma.user.findUnique({ where: { email: config.ownerEmail } });
  if (existing) {
    console.log(`Skipping ${config.restaurantName} — ${config.ownerEmail} already exists.`);
    return;
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const owner = await prisma.user.create({
    data: {
      email: config.ownerEmail,
      name: config.ownerName,
      role: "RESTAURANT_OWNER",
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });

  const restaurant = await prisma.restaurant.create({
    data: {
      ownerId: owner.id,
      name: config.restaurantName,
      slug: config.slug,
      cuisine: config.cuisine,
      description: config.description,
      minOrderCents: 1200,
      address: config.address,
      latitude: config.latitude,
      longitude: config.longitude,
      deliveryRadiusKm: config.deliveryRadiusKm,
      approvalStatus: "APPROVED",
      signupFeeCents: 5000,
      signupFeePaidAt: new Date(),
      menuItems: config.menuItems,
    },
  });

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = dateAtMidnight(dayOffset);
    await prisma.deliverySlot.create({
      data: {
        restaurantId: restaurant.id,
        date,
        windowStart: config.slotWindow.start,
        windowEnd: config.slotWindow.end,
        capacity: config.slotWindow.capacity,
        bookedCount: dayOffset % 4,
        cutoffAt: cutoffFor(date, 15),
      },
    });
  }

  console.log(`Created ${config.restaurantName} (owner: ${config.ownerEmail}).`);
}

async function main() {
  await seedRestaurantIfMissing({
    ownerEmail: "owner@mamakayas.test",
    ownerName: "Kaya",
    restaurantName: "Mama Kaya's Kitchen",
    slug: "mama-kayas-kitchen",
    cuisine: "West African",
    description: "Home-style Nigerian and Ghanaian cooking, made fresh for your chosen day.",
    address: "8 Sadler Gate, Derby, DE1 3NR",
    latitude: 52.9235,
    longitude: -1.4755,
    deliveryRadiusKm: 6,
    slotWindow: { start: "18:00", end: "19:00", capacity: 25 },
    menuItems: {
      create: [
        { name: "Jollof rice with grilled chicken", priceCents: 1350, description: "Jollof rice served with a grilled chicken thigh." },
        { name: "Egusi soup", priceCents: 1250, description: "Ground melon seed stew with leafy greens, served with pounded yam." },
        { name: "Suya", priceCents: 950, description: "Grilled spiced beef skewers, suya pepper spice mix." },
        { name: "Plantain (fried)", priceCents: 400 },
        { name: "Puff puff", priceCents: 450, description: "Lightly sweet fried dough balls." },
      ],
    },
  });

  await seedRestaurantIfMissing({
    ownerEmail: "owner@delhispicehouse.test",
    ownerName: "Anjali",
    restaurantName: "Delhi Spice House",
    slug: "delhi-spice-house",
    cuisine: "Indian",
    description: "North Indian classics, slow-cooked and ready for scheduled delivery.",
    address: "22 St Peter's Street, Derby, DE1 2AB",
    latitude: 52.921,
    longitude: -1.475,
    deliveryRadiusKm: 7,
    slotWindow: { start: "18:30", end: "19:30", capacity: 25 },
    menuItems: {
      create: [
        {
          name: "Chicken tikka masala",
          priceCents: 1200,
          description: "Grilled chicken in a spiced tomato-cream sauce.",
          modifierGroups: {
            create: [
              {
                name: "Spice level",
                minSelect: 1,
                maxSelect: 1,
                options: {
                  create: [
                    { name: "Mild", priceDeltaCents: 0 },
                    { name: "Medium", priceDeltaCents: 0 },
                    { name: "Hot", priceDeltaCents: 0 },
                  ],
                },
              },
            ],
          },
        },
        { name: "Lamb rogan josh", priceCents: 1350, description: "Slow-braised lamb, Kashmiri chilli, aromatic spices." },
        { name: "Vegetable biryani", priceCents: 1100, description: "Basmati rice layered with spiced vegetables." },
        { name: "Garlic naan", priceCents: 350 },
        { name: "Mango lassi", priceCents: 400 },
      ],
    },
  });

  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
