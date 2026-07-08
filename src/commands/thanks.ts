import type { Message } from "discord.js";
import type { PrefixCommand } from "../types";
import { awardPoints, ensureUser } from "../services/points";
import { awardThanksXp, syncRoles } from "../services/gamification";
import { successEmbed, errorEmbed, warningEmbed } from "../utils/embedBuilder";
import { handleError } from "../utils/errorHandler";
import {
  THANKS_POINTS,
  THANKS_COOLDOWN_MS,
  USER_FACING_ERRORS,
} from "../utils/constants";
import { logger } from "../utils/logger";

const cooldowns = new Map<string, number>();

export const thanksCommand: PrefixCommand = {
  name: "thanks",
  aliases: [],
  description: "Award 10 AzC Points to a user",
  async execute(message: Message, _args: string[]): Promise<void> {
    try {
      if (message.guild === null) {
        await message.reply({
          embeds: [warningEmbed("Server Only", "This command only works in a server.")],
        });
        return;
      }

      const target = message.mentions.users.first();
      if (!target) {
        await message.reply({
          embeds: [errorEmbed("User Not Mentioned", USER_FACING_ERRORS.noMention)],
        });
        return;
      }

      if (target.id === message.author.id) {
        await message.reply({
          embeds: [warningEmbed("Not Yourself", USER_FACING_ERRORS.selfThanks)],
        });
        return;
      }

      if (target.bot) {
        await message.reply({
          embeds: [warningEmbed("Not Bots", USER_FACING_ERRORS.botThanks)],
        });
        return;
      }

      const cooldownKey = `${message.author.id}:${target.id}`;
      const lastUsed = cooldowns.get(cooldownKey);
      if (lastUsed && Date.now() - lastUsed < THANKS_COOLDOWN_MS) {
        const remaining = Math.ceil((THANKS_COOLDOWN_MS - (Date.now() - lastUsed)) / 60_000);
        await message.reply({
          embeds: [
            warningEmbed(
              "Cooldown",
              `You need to wait about ${remaining} minute(s) before thanking this user again.`,
            ),
          ],
        });
        return;
      }
      cooldowns.set(cooldownKey, Date.now());

      await ensureUser(target.id, target.username);
      await ensureUser(message.author.id, message.author.username);

      await awardPoints(
        target.id,
        THANKS_POINTS,
        `Thanked by ${message.author.username}`,
      );

      const { leveledUp, newLevel } = await awardThanksXp(
        target.id,
        target.username,
      );

      if (leveledUp) {
        await syncRoles(message.guild, target.id, newLevel);
      }

      const embed = successEmbed(
        "Thanks Recorded",
        `${target} received **${THANKS_POINTS} AzC Points**! Thanked by ${message.author}.`,
      );

      if (leveledUp) {
        embed.addFields({
          name: "Level Up!",
          value: `${target} is now **level ${newLevel}**! 🎉`,
          inline: false,
        });
      }

      await message.reply({ embeds: [embed] });
    } catch (error) {
      const msg = handleError("thanksCommand", error);
      logger.error("thanksCommand failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      await message.reply({
        embeds: [errorEmbed("Error", msg)],
      }).catch(() => {
      });
    }
  },
};
