import { REST } from "discord.js";
import { Routes } from "discord.js";
import type { Client } from "discord.js";
import type { SlashCommand, PrefixCommand } from "../types";
import { logger } from "../utils/logger";

import { profileCommand } from "./profile";
import { leaderboardCommand } from "./leaderboard";
import { helpCommand } from "./help";
import { dailyCommand } from "./daily";
import { thanksCommand } from "./thanks";
import { ayarCommand } from "./ayar";
import { notifyCommand } from "./notify";

export const slashCommands: SlashCommand[] = [
  profileCommand,
  leaderboardCommand,
  helpCommand,
  dailyCommand,
  ayarCommand,
  notifyCommand,
];

export const prefixCommands: PrefixCommand[] = [thanksCommand];

export const prefixCommandMap = new Map<string, PrefixCommand>();
for (const cmd of prefixCommands) {
  prefixCommandMap.set(cmd.name, cmd);
  for (const alias of cmd.aliases ?? []) {
    prefixCommandMap.set(alias, cmd);
  }
}

export function getPrefixCommand(name: string): PrefixCommand | undefined {
  return prefixCommandMap.get(name.toLowerCase());
}

export async function registerCommands(_client: Client<true>): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!token || !clientId) {
    throw new Error("DISCORD_TOKEN and DISCORD_CLIENT_ID are required");
  }

  const rest = new REST({ version: "10" }).setToken(token);
  const body = slashCommands.map((cmd) => cmd.data.toJSON());

  const isDev = process.env.NODE_ENV !== "production";
  const guildId = process.env.DISCORD_GUILD_ID;

  if (isDev && guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body,
    });
    logger.info(`Registered ${body.length} slash commands to dev guild ${guildId}`);
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body });
    logger.info(`Registered ${body.length} slash commands globally`);
  }
}

export function getSlashCommand(name: string): SlashCommand | undefined {
  return slashCommands.find((cmd) => cmd.data.name === name);
}
