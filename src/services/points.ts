import { db } from "./database";
import { logger } from "../utils/logger";

export async function ensureUser(
  discordId: string,
  username: string,
): Promise<void> {
  await db.user.upsert({
    where: { discordId },
    update: { username },
    create: { discordId, username },
  });
}

export async function awardPoints(
  discordId: string,
  amount: number,
  description: string,
): Promise<void> {
  const user = await db.user.findUnique({ where: { discordId } });
  if (!user) {
    logger.warn(`awardPoints: user ${discordId} not found`);
    return;
  }

  await db.$transaction([
    db.user.update({
      where: { discordId },
      data: { azcPoints: { increment: amount } },
    }),
    db.transaction.create({
      data: {
        userId: user.id,
        amount,
        type: "EARN",
        description,
      },
    }),
  ]);
}

export async function deductPoints(
  discordId: string,
  amount: number,
  description: string,
): Promise<boolean> {
  const user = await db.user.findUnique({ where: { discordId } });
  if (!user) {
    logger.warn(`deductPoints: user ${discordId} not found`);
    return false;
  }
  if (user.azcPoints < amount) {
    return false;
  }

  await db.$transaction([
    db.user.update({
      where: { discordId },
      data: { azcPoints: { decrement: amount } },
    }),
    db.transaction.create({
      data: {
        userId: user.id,
        amount,
        type: "SPEND",
        description,
      },
    }),
  ]);

  return true;
}

export async function transferPoints(
  fromDiscordId: string,
  toDiscordId: string,
  amount: number,
  description: string,
): Promise<boolean> {
  const [fromUser, toUser] = await Promise.all([
    db.user.findUnique({ where: { discordId: fromDiscordId } }),
    db.user.findUnique({ where: { discordId: toDiscordId } }),
  ]);

  if (!fromUser || !toUser) {
    logger.warn(`transferPoints: user not found`, { fromDiscordId, toDiscordId });
    return false;
  }
  if (fromUser.azcPoints < amount) {
    return false;
  }

  await db.$transaction([
    db.user.update({
      where: { discordId: fromDiscordId },
      data: { azcPoints: { decrement: amount } },
    }),
    db.user.update({
      where: { discordId: toDiscordId },
      data: { azcPoints: { increment: amount } },
    }),
    db.transaction.create({
      data: {
        userId: fromUser.id,
        amount,
        type: "TRANSFER",
        description: `${description} (to ${toDiscordId})`,
      },
    }),
    db.transaction.create({
      data: {
        userId: toUser.id,
        amount,
        type: "TRANSFER",
        description: `${description} (from ${fromDiscordId})`,
      },
    }),
  ]);

  return true;
}

export async function getBalance(discordId: string): Promise<number> {
  const user = await db.user.findUnique({ where: { discordId } });
  return user?.azcPoints ?? 0;
}

export async function getTransactionHistory(
  discordId: string,
  limit = 10,
  offset = 0,
): Promise<{
  id: string;
  amount: number;
  type: string;
  description: string | null;
  createdAt: Date;
}[]> {
  const user = await db.user.findUnique({ where: { discordId } });
  if (!user) return [];

  return db.transaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });
}

export async function getRank(discordId: string): Promise<number | null> {
  const user = await db.user.findUnique({ where: { discordId } });
  if (!user) return null;

  const count = await db.user.count({
    where: { azcPoints: { gt: user.azcPoints } },
  });

  return count + 1;
}
