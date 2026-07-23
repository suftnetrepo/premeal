import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "password123";

function dateAtMidnight(daysFromNow: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(0, 0, 0, 0);
  return d;
}

function cutoffFor(date: Date, hour: number): Date {
  // Cutoff is the same day as delivery, at the given hour.
  const cutoff = new Date(date);
  cutoff.setHours(hour, 0, 0, 0);
  return cutoff;
}

async function main() {
  console.log("Seeding...");

  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.deliverySlot.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.user.deleteMany();

  const demoPasswordHash = await hashPassword(DEMO_PASSWORD);

  const sakuraOwner = await prisma.user.create({
    data: {
      email: "owner@sakurasushi.test",
      name: "Sakura Owner",
      role: "RESTAURANT_OWNER",
      passwordHash: demoPasswordHash,
      emailVerifiedAt: new Date(), // pre-verified for convenience — this is demo/seed data
    },
  });
  const luigiOwner = await prisma.user.create({
    data: {
      email: "owner@luigiskitchen.test",
      name: "Luigi",
      role: "RESTAURANT_OWNER",
      passwordHash: demoPasswordHash,
      emailVerifiedAt: new Date(), // pre-verified for convenience — this is demo/seed data
    },
  });
  const demoCustomer = await prisma.user.create({
    data: {
      email: "customer@premeal.test",
      name: "Demo Customer",
      role: "CUSTOMER",
      passwordHash: demoPasswordHash,
      emailVerifiedAt: new Date(), // pre-verified for convenience — this is demo/seed data
    },
  });

  await prisma.user.create({
    data: {
      email: "admin@premeal.test",
      name: "Admin",
      role: "ADMIN",
      passwordHash: demoPasswordHash,
      emailVerifiedAt: new Date(), // pre-verified for convenience — this is demo/seed data
    },
  });

  await prisma.address.createMany({
    data: [
      {
        userId: demoCustomer.id,
        label: "Home",
        // Deliberately on the same street as Sakura Sushi (see below) —
        // both restaurants are seeded in Derby, and this address existed
        // from before the delivery-radius check was built, when nothing
        // enforced that the demo customer's address needed to actually be
        // near the demo restaurants. Sharing the street guarantees this
        // stays within range regardless of exact geocoding precision.
        address: "5 Iron Gate, Derby, DE1 3GL",
        isDefault: true,
      },
      {
        userId: demoCustomer.id,
        label: "Work",
        // Same idea, on Luigi's Kitchen's street instead.
        address: "20 Friar Gate, Derby, DE1 1DZ",
        isDefault: false,
      },
    ],
  });

  const sakura = await prisma.restaurant.create({
    data: {
      ownerId: sakuraOwner.id,
      name: "Sakura Sushi",
      slug: "sakura-sushi",
      cuisine: "Japanese",
      description: "Fresh sushi and donburi, batch-prepared for scheduled delivery.",
      minOrderCents: 1200,
      address: "12 Iron Gate, Derby, DE1 3GL",
      latitude: 52.9225,
      longitude: -1.4746,
      deliveryRadiusKm: 8,
      approvalStatus: "APPROVED",
      signupFeeCents: 5000,
      signupFeePaidAt: new Date(),
      menuItems: {
        create: [
          {
            name: "Salmon set",
            priceCents: 1250,
            description: "Grilled salmon, rice, and seasonal sides.",
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
                      { name: "Spicy", priceDeltaCents: 0 },
                    ],
                  },
                },
                {
                  name: "Extras",
                  minSelect: 0,
                  maxSelect: 3,
                  options: {
                    create: [
                      { name: "Extra rice", priceDeltaCents: 150 },
                      { name: "Extra salmon", priceDeltaCents: 350 },
                      { name: "Seaweed salad", priceDeltaCents: 250 },
                    ],
                  },
                },
              ],
            },
          },
          { name: "Chirashi bowl", priceCents: 1350 },
          { name: "Unagi don", priceCents: 1400 },
          { name: "Miso soup", priceCents: 350 },
        ],
      },
    },
  });

  const luigis = await prisma.restaurant.create({
    data: {
      ownerId: luigiOwner.id,
      name: "Luigi's Kitchen",
      slug: "luigis-kitchen",
      cuisine: "Italian",
      description: "Slow-cooked Italian classics, made to order for your chosen day.",
      minOrderCents: 1500,
      address: "45 Friar Gate, Derby, DE1 1DZ",
      latitude: 52.923,
      longitude: -1.482,
      deliveryRadiusKm: 5,
      approvalStatus: "APPROVED",
      signupFeeCents: 5000,
      signupFeePaidAt: new Date(),
      menuItems: {
        create: [
          {
            name: "Lasagna",
            priceCents: 1100,
            description: "Layered pasta, slow-cooked ragù, béchamel.",
            modifierGroups: {
              create: [
                {
                  name: "Size",
                  minSelect: 1,
                  maxSelect: 1,
                  options: {
                    create: [
                      { name: "Regular", priceDeltaCents: 0 },
                      { name: "Large", priceDeltaCents: 300 },
                    ],
                  },
                },
              ],
            },
          },
          { name: "Margherita pizza", priceCents: 950 },
          { name: "Tiramisu", priceCents: 550 },
        ],
      },
    },
  });

  // Next 7 days, one dinner window (18:00-19:00) per restaurant per day,
  // with capacity levels that mirror the mockups: today near-full for
  // Sakura, a mix of available/limited/full further out.
  const capacityByDay = [30, 42, 12, 8, 5, 0, 20]; // bookedCount for Sakura, day 0..6
  const capacityMax = 50;

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = dateAtMidnight(dayOffset);

    await prisma.deliverySlot.create({
      data: {
        restaurantId: sakura.id,
        date,
        windowStart: "18:00",
        windowEnd: "19:00",
        capacity: capacityMax,
        bookedCount: capacityByDay[dayOffset],
        cutoffAt: cutoffFor(date, 15), // order by 3pm same day
      },
    });

    await prisma.deliverySlot.create({
      data: {
        restaurantId: luigis.id,
        date,
        windowStart: "18:30",
        windowEnd: "19:30",
        capacity: 30,
        bookedCount: dayOffset === 0 ? 27 : dayOffset % 3, // Friday-ish near full
        cutoffAt: cutoffFor(date, 14),
      },
    });
  }

  console.log("Seeded:", { sakura: sakura.name, luigis: luigis.name });

  // Subscriptions start disabled — the plan is to introduce Pre-Meal+
  // once there's real repeat-order data to price it against, not at
  // launch. Flip it on any time from /admin/feature-flags.
  await prisma.featureFlag.upsert({
    where: { key: "subscriptions" },
    update: {},
    create: {
      key: "subscriptions",
      enabled: false,
      description: "Pre-Meal+ customer subscriptions (free delivery + 5% off)",
    },
  });

  // Demo categories, so the category feature is testable without setting
  // any up by hand first.
  const [sakuraMains, sakuraSides] = await Promise.all([
    prisma.menuCategory.create({ data: { restaurantId: sakura.id, name: "Main Meals", sortOrder: 0 } }),
    prisma.menuCategory.create({ data: { restaurantId: sakura.id, name: "Sides", sortOrder: 1 } }),
  ]);
  await prisma.menuItem.updateMany({
    where: { restaurantId: sakura.id, name: { in: ["Salmon set", "Chirashi bowl", "Unagi don"] } },
    data: { categoryId: sakuraMains.id },
  });
  await prisma.menuItem.updateMany({
    where: { restaurantId: sakura.id, name: "Miso soup" },
    data: { categoryId: sakuraSides.id },
  });

  const [luigiMains, luigiDesserts] = await Promise.all([
    prisma.menuCategory.create({ data: { restaurantId: luigis.id, name: "Main Meals", sortOrder: 0 } }),
    prisma.menuCategory.create({ data: { restaurantId: luigis.id, name: "Desserts", sortOrder: 1 } }),
  ]);
  await prisma.menuItem.updateMany({
    where: { restaurantId: luigis.id, name: { in: ["Lasagna", "Margherita pizza"] } },
    data: { categoryId: luigiMains.id },
  });
  await prisma.menuItem.updateMany({
    where: { restaurantId: luigis.id, name: "Tiramisu" },
    data: { categoryId: luigiDesserts.id },
  });

  console.log(`\nDemo logins (password: "${DEMO_PASSWORD}" for all):`);
  console.log("  owner@sakurasushi.test   (restaurant owner)");
  console.log("  owner@luigiskitchen.test (restaurant owner)");
  console.log("  customer@premeal.test    (customer)");
  console.log("  admin@premeal.test       (admin)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
