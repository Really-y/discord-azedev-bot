import { db } from "./database";
import { logger } from "../utils/logger";

export const SETTING_KEYS = {
  dailyQuestionChannelId: "DAILY_QUESTION_CHANNEL_ID",
  coffeeRouletteChannelId: "COFFEE_ROULETTE_CHANNEL_ID",
  leaderboardChannelId: "LEADERBOARD_CHANNEL_ID",
  activMemberRoleId: "ACTIV_MEMBER_ROLE_ID",
  veteranRoleId: "VETERAN_ROLE_ID",
  elitRoleId: "ELIT_ROLE_ID",
  pingRoleId: "PING_ROLE_ID",
  adminUserIds: "ADMIN_USER_IDS",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

const ENV_FALLBACK: Record<SettingKey, string> = {
  DAILY_QUESTION_CHANNEL_ID: process.env.DAILY_QUESTION_CHANNEL_ID ?? "",
  COFFEE_ROULETTE_CHANNEL_ID: process.env.COFFEE_ROULETTE_CHANNEL_ID ?? "",
  LEADERBOARD_CHANNEL_ID: process.env.LEADERBOARD_CHANNEL_ID ?? "",
  ACTIV_MEMBER_ROLE_ID: process.env.ACTIV_MEMBER_ROLE_ID ?? "",
  VETERAN_ROLE_ID: process.env.VETERAN_ROLE_ID ?? "",
  ELIT_ROLE_ID: process.env.ELIT_ROLE_ID ?? "",
  PING_ROLE_ID: process.env.PING_ROLE_ID ?? "",
  ADMIN_USER_IDS: process.env.ADMIN_USER_IDS ?? "",
};

export async function getSetting(key: SettingKey): Promise<string> {
  const row = await db.setting.findUnique({ where: { key } }).catch(() => null);
  if (row && row.value) return row.value;
  return ENV_FALLBACK[key] ?? "";
}

export async function setSetting(key: SettingKey, value: string): Promise<void> {
  await db.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  logger.info(`Setting updated: ${key}`, { value });
}

export async function getAllSettings(): Promise<
  Record<SettingKey, string>
> {
  const rows = await db.setting.findMany();
  const dbMap = new Map(rows.map((r) => [r.key, r.value] as const));

  const result = {} as Record<SettingKey, string>;
  for (const key of Object.values(SETTING_KEYS)) {
    result[key] = dbMap.get(key) ?? ENV_FALLBACK[key] ?? "";
  }
  return result;
}

export async function getChannelIds(): Promise<{
  dailyQuestion: string;
  coffeeRoulette: string;
  leaderboard: string;
}> {
  const [dailyQuestion, coffeeRoulette, leaderboard] = await Promise.all([
    getSetting(SETTING_KEYS.dailyQuestionChannelId),
    getSetting(SETTING_KEYS.coffeeRouletteChannelId),
    getSetting(SETTING_KEYS.leaderboardChannelId),
  ]);
  return { dailyQuestion, coffeeRoulette, leaderboard };
}

export async function getRoleIds(): Promise<{
  activ: string;
  veteran: string;
  elit: string;
}> {
  const [activ, veteran, elit] = await Promise.all([
    getSetting(SETTING_KEYS.activMemberRoleId),
    getSetting(SETTING_KEYS.veteranRoleId),
    getSetting(SETTING_KEYS.elitRoleId),
  ]);
  return { activ, veteran, elit };
}

export async function getPingRoleId(): Promise<string> {
  return getSetting(SETTING_KEYS.pingRoleId);
}

export async function getAdminUserIds(): Promise<string[]> {
  const raw = await getSetting(SETTING_KEYS.adminUserIds);
  const envIds = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const dbIds = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...envIds, ...dbIds])];
}

export async function addAdminUserId(userId: string): Promise<void> {
  const current = await getSetting(SETTING_KEYS.adminUserIds);
  const ids = current
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.includes(userId)) return;
  ids.push(userId);
  await setSetting(SETTING_KEYS.adminUserIds, ids.join(","));
}

export async function removeAdminUserId(userId: string): Promise<void> {
  const current = await getSetting(SETTING_KEYS.adminUserIds);
  const ids = current
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((id) => id !== userId);
  await setSetting(SETTING_KEYS.adminUserIds, ids.join(","));
}
