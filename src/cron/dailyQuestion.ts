import cron from "node-cron";
import { TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { Client } from "discord.js";
import { db } from "../services/database";
import { generateDailyQuestion } from "../services/ai";
import { getChannelIds, getPingRoleId } from "../services/settings";
import { dailyQuestionEmbed } from "../utils/embedBuilder";
import { logger } from "../utils/logger";
import {
  FALLBACK_DAILY_QUESTIONS,
  TIMEZONE,
} from "../utils/constants";

let running = false;

export function startDailyQuestion(client: Client): void {
  cron.schedule(
    "0 10 * * *",
    async () => {
      if (running) {
        logger.warn("dailyQuestion: previous run still active, skipping");
        return;
      }
      running = true;
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const existing = await db.dailyQuestion.findFirst({
          where: { date: today },
        });
        if (existing) {
          logger.info("dailyQuestion: question already exists for today");
          return;
        }

        let question = await generateDailyQuestion();
        let createdBy = "AI";

        if (!question) {
          logger.warn("dailyQuestion: AI unavailable, using fallback");
          question =
            FALLBACK_DAILY_QUESTIONS[
              Math.floor(Math.random() * FALLBACK_DAILY_QUESTIONS.length)
            ];
          createdBy = "AI-fallback";
        }

        const created = await db.dailyQuestion.create({
          data: { question, date: today, createdBy },
        });

        const channelIds = await getChannelIds();
        if (channelIds.dailyQuestion) {
          const channel = await client.channels
            .fetch(channelIds.dailyQuestion)
            .catch(() => null);

          if (channel && channel instanceof TextChannel) {
            const embed = dailyQuestionEmbed(created.question, created.date);
            const pingRoleId = await getPingRoleId();
            const content = pingRoleId ? `<@&${pingRoleId}>` : undefined;

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId("daily_ping_toggle")
                .setLabel("Toggle Ping Notifications")
                .setEmoji("🔔")
                .setStyle(
                  pingRoleId ? ButtonStyle.Secondary : ButtonStyle.Secondary,
                ),
            );

            await channel.send({
              content,
              embeds: [embed],
              components: pingRoleId ? [row] : [],
              allowedMentions: { roles: pingRoleId ? [pingRoleId] : [] },
            });
            logger.info("dailyQuestion: posted to channel");
          } else {
            logger.warn("dailyQuestion: channel not found or not text channel");
          }
        }
      } catch (error) {
        logger.error("dailyQuestion failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        running = false;
      }
    },
    { timezone: TIMEZONE },
  );
  logger.info("dailyQuestion cron scheduled (0 10 * * *)");
}
