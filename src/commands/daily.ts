import { SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { SlashCommand } from "../types";
import { db } from "../services/database";
import { generateDailyQuestion } from "../services/ai";
import { awardPoints } from "../services/points";
import { awardDailyParticipationXp } from "../services/gamification";
import {
  dailyQuestionEmbed,
  errorEmbed,
  warningEmbed,
} from "../utils/embedBuilder";
import { handleError } from "../utils/errorHandler";
import {
  ADMIN_USER_IDS,
  DAILY_PARTICIPATION_POINTS,
  FALLBACK_DAILY_QUESTIONS,
  USER_FACING_ERRORS,
} from "../utils/constants";
import { logger } from "../utils/logger";

export const dailyCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Daily question — view or trigger a new one")
    .addStringOption((opt) =>
      opt
        .setName("action")
        .setDescription("Action to take")
        .setRequired(false)
        .addChoices(
          { name: "View", value: "view" },
          { name: "Trigger (admin)", value: "trigger" },
        ),
    ) as SlashCommandBuilder,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const action = interaction.options.getString("action") ?? "view";

      if (action === "trigger") {
        if (!ADMIN_USER_IDS.includes(interaction.user.id)) {
          await interaction.reply({
            embeds: [errorEmbed("Permission Denied", USER_FACING_ERRORS.noPermission)],
            ephemeral: true,
          });
          return;
        }

        await interaction.deferReply();

        const question = await generateDailyQuestion();
        if (!question) {
          logger.warn("dailyCommand: AI unavailable, using fallback");
          const fallback =
            FALLBACK_DAILY_QUESTIONS[
              Math.floor(Math.random() * FALLBACK_DAILY_QUESTIONS.length)
            ];
          await saveAndPost(interaction, fallback, "manual-fallback");
          return;
        }

        await saveAndPost(interaction, question, "manual");
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const question = await db.dailyQuestion.findFirst({
        where: { date: today },
      });

        if (!question) {
        await interaction.reply({
          embeds: [warningEmbed("No Question", USER_FACING_ERRORS.noQuestionToday)],
          ephemeral: true,
        });
        return;
      }

      const embed = dailyQuestionEmbed(question.question, question.date);
      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      const msg = handleError("dailyCommand", error);
      const alreadyReplied = interaction.deferred || interaction.replied;
      await interaction[alreadyReplied ? "followUp" : "reply"]({
        embeds: [errorEmbed("Error", msg)],
        ephemeral: true,
      });
    }
  },
};

async function saveAndPost(
  interaction: ChatInputCommandInteraction,
  questionText: string,
  createdBy: string,
): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await db.dailyQuestion.deleteMany({ where: { date: today } });
  const created = await db.dailyQuestion.create({
    data: {
      question: questionText,
      date: today,
      createdBy,
    },
  });

  const embed = dailyQuestionEmbed(created.question, created.date);
  await interaction.editReply({ embeds: [embed] });

  await awardPoints(
    interaction.user.id,
    DAILY_PARTICIPATION_POINTS,
    "Triggered daily question (manual)",
  );
  await awardDailyParticipationXp(
    interaction.user.id,
    interaction.user.username,
  );
}
