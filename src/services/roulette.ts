import { db } from "./database";
import { logger } from "../utils/logger";
import {
  ROULETTE_ACTIVE_WINDOW_DAYS,
  ROULETTE_RECENT_PAIR_WEEKS,
} from "../utils/constants";
import type { CoffeePairResult } from "../types";

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function getIsoWeek(date: Date): string {
  const target = new Date(date.valueOf());
  const dayNumber = (date.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = target.getTime() - firstThursday.getTime();
  const weekNum =
    1 +
    Math.round(
      (diff / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7,
    );
  return `${target.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

export async function generatePairs(week: string): Promise<{
  pairs: CoffeePairResult[];
  oddUser: { discordId: string; username: string } | null;
}> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ROULETTE_ACTIVE_WINDOW_DAYS);

  const recentWeeksCutoff = new Date();
  recentWeeksCutoff.setDate(recentWeeksCutoff.getDate() - ROULETTE_RECENT_PAIR_WEEKS * 7);

  const activeUsers = await db.user.findMany({
    where: {
      lastActive: { gte: cutoff },
    },
    select: { id: true, discordId: true, username: true },
  });

  if (activeUsers.length === 0) {
    logger.info("Roulette: no active users found");
    return { pairs: [], oddUser: null };
  }

  const recentlyPairedUserIds = new Set<string>();
  const recentPairs = await db.coffeePair.findMany({
    where: { pairedAt: { gte: recentWeeksCutoff } },
    select: { user1Id: true, user2Id: true },
  });
  for (const p of recentPairs) {
    recentlyPairedUserIds.add(p.user1Id);
    recentlyPairedUserIds.add(p.user2Id);
  }

  const eligible = activeUsers.filter((u) => !recentlyPairedUserIds.has(u.id));

  const pool =
    eligible.length >= 2 ? eligible : activeUsers;
  const shuffled = fisherYatesShuffle(pool);

  const pairs: CoffeePairResult[] = [];
  const dbPairs: { user1Id: string; user2Id: string | null }[] = [];
  let oddUser: { discordId: string; username: string } | null = null;

  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    const a = shuffled[i];
    const b = shuffled[i + 1];
    pairs.push({
      user1DiscordId: a.discordId,
      user2DiscordId: b.discordId,
      user1Username: a.username,
      user2Username: b.username,
    });
    dbPairs.push({ user1Id: a.id, user2Id: b.id });
  }

  if (shuffled.length % 2 === 1) {
    const last = shuffled[shuffled.length - 1];
    oddUser = { discordId: last.discordId, username: last.username };
    dbPairs.push({ user1Id: last.id, user2Id: null });
  }

  await db.$transaction(
    dbPairs
      .filter((p) => p.user2Id !== null)
      .map((p) =>
        db.coffeePair.create({
          data: {
            user1Id: p.user1Id,
            user2Id: p.user2Id as string,
            week,
          },
        }),
      ),
  );

  logger.info(`Roulette: created ${pairs.length} pairs for week ${week}`, {
    oddUser: oddUser?.discordId ?? null,
  });

  return { pairs, oddUser };
}
