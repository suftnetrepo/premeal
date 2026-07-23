/**
 * One-off cleanup for duplicate saved addresses created before the dedup
 * fix in src/lib/addresses.ts. Groups each user's addresses by normalized
 * text, keeps one per group (the current default if one of the
 * duplicates is marked default, otherwise the oldest), deletes the rest.
 * Safe to run more than once — a user with no duplicates is a no-op.
 *
 * Usage: npx tsx scripts/dedupe-addresses.ts
 */
import { prisma } from "../src/lib/db";

async function main() {
  const addresses = await prisma.address.findMany({ orderBy: { createdAt: "asc" } });

  const groups = new Map<string, typeof addresses>();
  for (const addr of addresses) {
    const key = `${addr.userId}::${addr.address.trim().toLowerCase()}`;
    const group = groups.get(key) ?? [];
    group.push(addr);
    groups.set(key, group);
  }

  let deletedCount = 0;

  for (const group of groups.values()) {
    if (group.length <= 1) continue;

    const keeper = group.find((a) => a.isDefault) ?? group[0];
    const toDelete = group.filter((a) => a.id !== keeper.id);

    await prisma.address.deleteMany({ where: { id: { in: toDelete.map((a) => a.id) } } });
    deletedCount += toDelete.length;

    console.log(`Deduped "${keeper.address}" for user ${keeper.userId}: kept 1, removed ${toDelete.length}`);
  }

  console.log(`\nDone. Removed ${deletedCount} duplicate address(es).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
