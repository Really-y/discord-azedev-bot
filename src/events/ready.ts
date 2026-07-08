import { Events, ActivityType, ChannelType, PermissionFlagsBits } from "discord.js";
import type { Client, Guild } from "discord.js";
import { registerCommands } from "../commands";
import { startAllCronJobs } from "../cron";
import { db } from "../services/database";
import {
  getChannelIds,
  getRoleIds,
  setSetting,
  SETTING_KEYS,
} from "../services/settings";
import { logger } from "../utils/logger";
import { BOT_STATUS_TEXT } from "../utils/constants";

export const readyEvent = {
  name: Events.ClientReady,
  once: true,
  async execute(client: Client<true>): Promise<void> {
    logger.info(`Logged in as ${client.user.tag}`);

    await db.$connect();
    logger.info("Database connected");

    await registerCommands(client);
    logger.info("Commands registered");

    for (const guild of client.guilds.cache.values()) {
      await autoSetupGuild(guild);
    }

    startAllCronJobs(client);
    logger.info("Cron jobs started");

    client.user.setActivity(BOT_STATUS_TEXT, { type: ActivityType.Watching });

    const guildCount = client.guilds.cache.size;
    logger.info(`Startup complete — operating in ${guildCount} guild(s)`, {
      guildCount,
    });
  },
};

async function autoSetupGuild(guild: Guild): Promise<void> {
  const me = guild.members.me;
  if (!me) return;

  const targetGuildId = process.env.DISCORD_GUILD_ID;
  if (targetGuildId && guild.id !== targetGuildId) return;

  const channelIds = await getChannelIds();
  const roleIds = await getRoleIds();

  const canManageChannels = me.permissions.has(PermissionFlagsBits.ManageChannels);
  const canManageRoles = me.permissions.has(PermissionFlagsBits.ManageRoles);

  if (!canManageChannels && !canManageRoles) return;

  const results: string[] = [];

  if (canManageChannels) {
    const channelsToCreate = [
      { name: "daily-question", topic: "AI-powered daily discussion questions", key: SETTING_KEYS.dailyQuestionChannelId, currentId: channelIds.dailyQuestion },
      { name: "coffee-roulette", topic: "Weekly random coffee chat pairings", key: SETTING_KEYS.coffeeRouletteChannelId, currentId: channelIds.coffeeRoulette },
      { name: "leaderboard", topic: "Top AzC Points earners", key: SETTING_KEYS.leaderboardChannelId, currentId: channelIds.leaderboard },
    ];

    for (const ch of channelsToCreate) {
      if (ch.currentId) {
        const exists = await guild.channels.fetch(ch.currentId).catch(() => null);
        if (exists) continue;
      }

      try {
        const channel = await guild.channels.create({
          name: ch.name,
          type: ChannelType.GuildText,
          topic: ch.topic,
          reason: "Azedev OS auto-setup",
        });
        await setSetting(ch.key, channel.id);
        results.push(`Created channel #${ch.name}`);
        logger.info(`Auto-created channel #${ch.name} (${channel.id}) in ${guild.id}`);
      } catch (error) {
        logger.error(`Failed to create channel ${ch.name} in ${guild.id}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  if (canManageRoles) {
    const rolesToCreate = [
      { name: "Active Member", color: 0x57f287 as const, key: SETTING_KEYS.activMemberRoleId, currentId: roleIds.activ },
      { name: "Veteran", color: 0x5865f2 as const, key: SETTING_KEYS.veteranRoleId, currentId: roleIds.veteran },
      { name: "Elite", color: 0xeb459e as const, key: SETTING_KEYS.elitRoleId, currentId: roleIds.elit },
    ];

    for (const r of rolesToCreate) {
      if (r.currentId) {
        const exists = await guild.roles.fetch(r.currentId).catch(() => null);
        if (exists) continue;
      }

      try {
        const role = await guild.roles.create({
          name: r.name,
          color: r.color,
          mentionable: true,
          reason: "Azedev OS auto-setup",
        });
        await setSetting(r.key, role.id);
        results.push(`Created role ${r.name}`);
        logger.info(`Auto-created role ${r.name} (${role.id}) in ${guild.id}`);
      } catch (error) {
        logger.error(`Failed to create role ${r.name} in ${guild.id}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  if (results.length > 0) {
    logger.info(`Auto-setup in ${guild.id}: ${results.join(", ")}`);
  }
}
