import { SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { SlashCommand } from "../types";
import { db } from "../services/database";
import { getBalance, getRank } from "../services/points";
import { xpForNextLevel } from "../services/gamification";
import { profileEmbed, errorEmbed } from "../utils/embedBuilder";
import { handleError } from "../utils/errorHandler";
import { USER_FACING_ERRORS } from "../utils/constants";

export const profileCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Display user profile — AzC Points, XP, level")
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("User to view profile (optional)")
        .setRequired(false),
    ) as SlashCommandBuilder,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const targetUser = interaction.options.getUser("user") ?? interaction.user;
      const discordId = targetUser.id;

      const dbUser = await db.user.findUnique({ where: { discordId } });

      if (!dbUser) {
        await interaction.reply({
          embeds: [errorEmbed("User Not Found", USER_FACING_ERRORS.userNotFound)],
          ephemeral: true,
        });
        return;
      }

      const [points, rank] = await Promise.all([
        getBalance(discordId),
        getRank(discordId),
      ]);

      const nextLevelXp = xpForNextLevel(dbUser.level);

      const embed = profileEmbed({
        username: dbUser.username,
        azcPoints: points,
        xp: dbUser.xp,
        level: dbUser.level,
        nextLevelXp,
        rank,
        lastActive: dbUser.lastActive,
        avatarURL: targetUser.displayAvatarURL() ?? undefined,
      });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      const msg = handleError("profileCommand", error);
      const alreadyReplied = interaction.deferred || interaction.replied;
      await interaction[alreadyReplied ? "followUp" : "reply"]({
        embeds: [errorEmbed("Error", msg)],
        ephemeral: true,
      });
    }
  },
};
