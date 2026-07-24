import { prisma } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/tokens";
import { hashPassword } from "@/lib/password";
import { notifyDriverInvite, notifyDriverAssociationRequest } from "@/lib/notifications";
import type { Restaurant, User } from "@prisma/client";

const INVITE_TOKEN_TTL_HOURS = 72;

export class DriverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DriverError";
  }
}

export class InvalidInviteTokenError extends Error {
  constructor(message = "This invite link is invalid or has expired.") {
    super(message);
    this.name = "InvalidInviteTokenError";
  }
}

/**
 * The single entry point for "add this email to my driver roster" —
 * branches into one of two real flows depending on whether that email
 * already belongs to a DRIVER account. Never silently grants access
 * either way: a brand-new driver has to actually sign up through the
 * invite link, an existing driver has to explicitly accept from their
 * own dashboard. Re-inviting an email that was previously DECLINED or
 * REMOVED resets it back to a fresh PENDING invite rather than being
 * blocked — a restaurant should be able to try again.
 */
export async function inviteDriver(restaurant: Restaurant, email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const existingDriver = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (existingDriver && existingDriver.role !== "DRIVER") {
    throw new DriverError("That email belongs to an existing account that isn't a driver account.");
  }

  if (existingDriver) {
    // Known driver — no token needed, they respond from their own
    // dashboard. Still notify them by email so they actually notice.
    const association = await prisma.restaurantDriver.upsert({
      where: { restaurantId_email: { restaurantId: restaurant.id, email: normalizedEmail } },
      update: { driverId: existingDriver.id, status: "PENDING", respondedAt: null, invitedAt: new Date() },
      create: { restaurantId: restaurant.id, email: normalizedEmail, driverId: existingDriver.id, status: "PENDING" },
    });
    void notifyDriverAssociationRequest(existingDriver, restaurant.name, association.id);
    return;
  }

  // Brand new — issue an invite token, same hashed-token pattern as
  // email verification / password reset (see src/lib/tokens.ts).
  const { token, tokenHash } = generateToken();
  await prisma.restaurantDriver.upsert({
    where: { restaurantId_email: { restaurantId: restaurant.id, email: normalizedEmail } },
    update: {
      driverId: null,
      status: "PENDING",
      respondedAt: null,
      invitedAt: new Date(),
      inviteTokenHash: tokenHash,
      inviteTokenExpiresAt: new Date(Date.now() + INVITE_TOKEN_TTL_HOURS * 60 * 60 * 1000),
    },
    create: {
      restaurantId: restaurant.id,
      email: normalizedEmail,
      status: "PENDING",
      inviteTokenHash: tokenHash,
      inviteTokenExpiresAt: new Date(Date.now() + INVITE_TOKEN_TTL_HOURS * 60 * 60 * 1000),
    },
  });
  void notifyDriverInvite(normalizedEmail, restaurant.name, token);
}

/**
 * A brand-new driver completing signup through their invite link.
 * Creates the account and accepts the invite in one step — going
 * through the link at all IS the acceptance, there's no separate later
 * "accept" click for this path (unlike an existing driver, who does
 * explicitly accept/decline — see respondToDriverRequest below).
 */
export async function acceptDriverInviteBySignup(
  rawToken: string,
  name: string,
  password: string
): Promise<User> {
  const tokenHash = hashToken(rawToken);
  const association = await prisma.restaurantDriver.findUnique({ where: { inviteTokenHash: tokenHash } });

  if (
    !association ||
    association.status !== "PENDING" ||
    !association.inviteTokenExpiresAt ||
    association.inviteTokenExpiresAt < new Date()
  ) {
    throw new InvalidInviteTokenError();
  }

  const passwordHash = await hashPassword(password);

  return prisma.$transaction(async (tx) => {
    const driver = await tx.user.create({
      data: { email: association.email, name, passwordHash, role: "DRIVER" },
    });
    await tx.restaurantDriver.update({
      where: { id: association.id },
      data: {
        driverId: driver.id,
        status: "ACTIVE",
        respondedAt: new Date(),
        inviteTokenHash: null,
        inviteTokenExpiresAt: null,
      },
    });
    return driver;
  });
}

/** An existing driver accepting or declining a pending request from their own dashboard. */
export async function respondToDriverRequest(
  driverUserId: string,
  restaurantDriverId: string,
  accept: boolean
): Promise<void> {
  const association = await prisma.restaurantDriver.findUnique({ where: { id: restaurantDriverId } });
  if (!association || association.driverId !== driverUserId) {
    throw new DriverError("Request not found.");
  }
  if (association.status !== "PENDING") {
    throw new DriverError("This request has already been responded to.");
  }

  await prisma.restaurantDriver.update({
    where: { id: restaurantDriverId },
    data: { status: accept ? "ACTIVE" : "DECLINED", respondedAt: new Date() },
  });
}

/**
 * Restaurant removes a driver from their roster. Blocks removal while
 * the driver has an active, undelivered order assigned to them at THIS
 * restaurant — silently removing them would leave a real delivery
 * orphaned mid-flight with no one authorized to update it. The caller
 * has to reassign or wait for those orders to resolve first.
 */
export async function removeDriverFromRestaurant(restaurant: Restaurant, restaurantDriverId: string): Promise<void> {
  const association = await prisma.restaurantDriver.findUnique({ where: { id: restaurantDriverId } });
  if (!association || association.restaurantId !== restaurant.id) {
    throw new DriverError("Driver not found on this restaurant's roster.");
  }

  if (association.driverId) {
    const activeOrders = await prisma.order.count({
      where: {
        restaurantId: restaurant.id,
        driverId: association.driverId,
        status: { in: ["CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY"] },
      },
    });
    if (activeOrders > 0) {
      throw new DriverError(
        `This driver has ${activeOrders} active ${activeOrders === 1 ? "delivery" : "deliveries"} in progress — reassign ${activeOrders === 1 ? "it" : "them"} before removing.`
      );
    }
  }

  await prisma.restaurantDriver.update({
    where: { id: restaurantDriverId },
    data: { status: "REMOVED", respondedAt: new Date() },
  });
}

/**
 * Assigns a driver to an order — only from that restaurant's own ACTIVE
 * roster, never an arbitrary user ID. This is the check that actually
 * enforces "a restaurant can only assign drivers who've accepted them
 * specifically," not just any DRIVER-role account that exists.
 */
export async function assignDriverToOrder(restaurant: Restaurant, orderId: string, driverUserId: string | null): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.restaurantId !== restaurant.id) {
    throw new DriverError("Order not found.");
  }

  if (driverUserId === null) {
    await prisma.order.update({ where: { id: orderId }, data: { driverId: null } });
    return;
  }

  const association = await prisma.restaurantDriver.findFirst({
    where: { restaurantId: restaurant.id, driverId: driverUserId, status: "ACTIVE" },
  });
  if (!association) {
    throw new DriverError("That driver isn't an active part of this restaurant's roster.");
  }

  await prisma.order.update({ where: { id: orderId }, data: { driverId: driverUserId } });
}
