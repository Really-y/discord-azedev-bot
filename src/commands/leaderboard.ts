import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import type {
  ChatInputCommandInteraction,
  ButtonInteraction,
} from "discord.js";
import type { SlashCommand } from "../types";
import { db } from "../services/database";
import { leaderboardEmbed, errorEmbed } from "../utils/embedBuilder";
import { handleError } from "../utils/errorHandler";
import { LEADERBOARD_PAGE_SIZE } from "../utils/constants";

export const leaderboardCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Leaderboard — top AzC Points earners") as SlashCommandBuilder,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const total = await db.user.count({
        where: { azcPoints: { gt: 0 } },
      });
      const totalPages = Math.max(1, Math.ceil(total / LEADERBOARD_PAGE_SIZE));

      let page = 0;

      const fetchPage = async (p: number) => {
        const users = await db.user.findMany({
          where: { azcPoints: { gt: 0 } },
          orderBy: { azcPoints: "desc" },
          take: LEADERBOARD_PAGE_SIZE,
          skip: p * LEADERBOARD_PAGE_SIZE,
          select: { username: true, azcPoints: true, level: true },
        });

        return users.map((u, i) => ({
          rank: p * LEADERBOARD_PAGE_SIZE + i + 1,
          username: u.username,
          azcPoints: u.azcPoints,
          level: u.level,
        }));
      };

      const buildRow = (p: number, totalP: number): ActionRowBuilder<ButtonBuilder> => {
        const row = new ActionRowBuilder<ButtonBuilder>();
        row.addComponents(
          new ButtonBuilder()
            .setCustomId("lb_prev")
            .setLabel("◀ Previous")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(p === 0),
        );
        row.addComponents(
          new ButtonBuilder()
            .setCustomId("lb_next")
            .setLabel("Next ▶")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(p >= totalP - 1),
        );
        return row;
      };

      const entries = await fetchPage(page);
      const embed = leaderboardEmbed(entries, page + 1, totalPages);
      const row = buildRow(page, totalPages);

      const reply = await interaction.reply({
        embeds: [embed],
        components: [row],
        fetchReply: true,
      });

      const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60_000,
      });

      collector.on("collect", async (btn: ButtonInteraction) => {
        if (btn.user.id !== interaction.user.id) {
          await btn.reply({
            content: "This button is not for you.",
            ephemeral: true,
          });
          return;
        }

        if (btn.customId === "lb_prev" && page > 0) {
          page--;
        } else if (btn.customId === "lb_next" && page < totalPages - 1) {
          page++;
        }

        const newEntries = await fetchPage(page);
        const newEmbed = leaderboardEmbed(newEntries, page + 1, totalPages);
        const newRow = buildRow(page, totalPages);
        await btn.update({ embeds: [newEmbed], components: [newRow] });
      });

      collector.on("end", async () => {
        try {
          await interaction.editReply({ components: [] });
        } catch {
          /* collector ended — ignore */
        }
      });
    } catch (error) {
      const msg = handleError("leaderboardCommand", error);
      const alreadyReplied = interaction.deferred || interaction.replied;
      await interaction[alreadyReplied ? "followUp" : "reply"]({
        embeds: [errorEmbed("Error", msg)],
        ephemeral: true,
      });
    }
  },
};
