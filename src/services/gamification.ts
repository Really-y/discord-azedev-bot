import { db } from "./database";
import { getRoleIds } from "./settings";
import { logger } from "../utils/logger";
import { XP_VALUES, ROLE_THRESHOLDS } from "../utils/constants";
import type { Guild, GuildMember } from "discord.js";

export function levelFromXp(totalXp: number): number {
  return Math.floor(Math.sqrt(totalXp / 100)) + 1;
}

export function xpForNextLevel(currentLevel: number): number {
  return currentLevel * currentLevel * 100;
}

export async function awardXp(
  discordId: string,
  username: string,
  amount: number,
): Promise<{ leveledUp: boolean; newLevel: number }> {
  const user = await db.user.upsert({
    where: { discordId },
    update: {},
    create: { discordId, username },
  });

  const oldLevel = user.level;
  const newXp = user.xp + amount;
  const newLevel = levelFromXp(newXp);

  await db.user.update({
    where: { discordId },
    data: { xp: newXp, level: newLevel, username },
  });

  const leveledUp = newLevel > oldLevel;
  if (leveledUp) {
    logger.info(`User ${discordId} leveled up: ${oldLevel} → ${newLevel}`);
  }

  return { leveledUp, newLevel };
}

const xpCooldowns = new Map<string, number>();

export async function awardMessageXp(
  discordId: string,
  username: string,
): Promise<{ leveledUp: boolean; newLevel: number } | null> {
  const now = Date.now();
  const last = xpCooldowns.get(discordId);
  if (last && now - last < 60_000) {
    return null;
  }
  xpCooldowns.set(discordId, now);

  return awardXp(discordId, username, XP_VALUES.message);
}

export async function awardThanksXp(
  discordId: string,
  username: string,
): Promise<{ leveledUp: boolean; newLevel: number }> {
  return awardXp(discordId, username, XP_VALUES.thanksReceived);
}

export async function awardDailyParticipationXp(
  discordId: string,
  username: string,
): Promise<{ leveledUp: boolean; newLevel: number }> {
  return awardXp(discordId, username, XP_VALUES.dailyParticipation);
}

export async function awardCoffeeRouletteXp(
  discordId: string,
  username: string,
): Promise<{ leveledUp: boolean; newLevel: number }> {
  return awardXp(discordId, username, XP_VALUES.coffeeRoulette);
}

export async function roleForLevel(
  level: number,
): Promise<string | null> {
  const roleIds = await getRoleIds();
  if (level >= ROLE_THRESHOLDS.elit) return roleIds.elit || null;
  if (level >= ROLE_THRESHOLDS.veteran) return roleIds.veteran || null;
  if (level >= ROLE_THRESHOLDS.activ) return roleIds.activ || null;
  return null;
}

export async function syncRoles(
  guild: Guild,
  discordId: string,
  level: number,
): Promise<void> {
  const member = await guild.members.fetch(discordId).catch(() => null);
  if (!member) return;

  const targetRoleId = await roleForLevel(level);
  if (!targetRoleId) return;

  await assignRole(member, targetRoleId, level);
}

async function assignRole(
  member: GuildMember,
  roleId: string,
  level: number,
): Promise<void> {
  if (member.roles.cache.has(roleId)) return;

  try {
    await member.roles.add(roleId);
    logger.info(`Role ${roleId} assigned to ${member.user.tag} (level ${level})`);
  } catch (error) {
    logger.error(`Failed to assign role ${roleId}`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function updateLastActive(discordId: string): Promise<void> {
  await db.user.update({
    where: { discordId },
    data: { lastActive: new Date() },
  }).catch(() => {
  });
}
