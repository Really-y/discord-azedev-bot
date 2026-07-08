import { SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { SlashCommand } from "../types";
import { helpEmbed, errorEmbed } from "../utils/embedBuilder";
import { handleError } from "../utils/errorHandler";

export const helpCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Bot usage guide and command list") as SlashCommandBuilder,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      await interaction.reply({ embeds: [helpEmbed()] });
    } catch (error) {
      const msg = handleError("helpCommand", error);
      const alreadyReplied = interaction.deferred || interaction.replied;
      await interaction[alreadyReplied ? "followUp" : "reply"]({
        embeds: [errorEmbed("Error", msg)],
        ephemeral: true,
      });
    }
  },
};
