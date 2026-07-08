import { Events } from "discord.js";
import type { Message } from "discord.js";
import { getPrefixCommand } from "../commands";
import { ensureUser } from "../services/points";
import { awardMessageXp, syncRoles, updateLastActive } from "../services/gamification";
import { PREFIX } from "../utils/constants";
import { logger } from "../utils/logger";

function parsePrefixCommand(content: string): { name: string; args: string[] } | null {
  if (!content.startsWith(PREFIX)) return null;
  const parts = content.slice(PREFIX.length).trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === "") return null;
  return { name: parts[0].toLowerCase(), args: parts.slice(1) };
}

export const messageCreateEvent = {
  name: Events.MessageCreate,
  async execute(message: Message): Promise<void> {
    try {
      if (message.author.bot) return;
      if (message.guild === null) return;

      const parsed = parsePrefixCommand(message.content);

      if (parsed) {
        const command = getPrefixCommand(parsed.name);
        if (command) {
          await command.execute(message, parsed.args);
          return;
        }
        return;
      }

      await ensureUser(message.author.id, message.author.username);
      await updateLastActive(message.author.id);

      const xpResult = await awardMessageXp(message.author.id, message.author.username);
      if (xpResult?.leveledUp) {
        await syncRoles(message.guild, message.author.id, xpResult.newLevel);
      }
    } catch (error) {
      logger.error(`[messageCreate] ${error instanceof Error ? error.message : String(error)}`, {
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  },
};
