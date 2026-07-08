import cron from "node-cron";
import { TextChannel } from "discord.js";
import type { Client } from "discord.js";
import { db } from "../services/database";
import { generatePairs, getIsoWeek } from "../services/roulette";
import { awardPoints } from "../services/points";
import { awardCoffeeRouletteXp } from "../services/gamification";
import { getChannelIds } from "../services/settings";
import { coffeeRouletteEmbed } from "../utils/embedBuilder";
import { logger } from "../utils/logger";
import {
  COFFEE_ROULETTE_POINTS,
  TIMEZONE,
} from "../utils/constants";

let running = false;

export function startCoffeeRoulette(client: Client): void {
  cron.schedule(
    "0 12 * * 5",
    async () => {
      if (running) {
        logger.warn("coffeeRoulette: previous run still active, skipping");
        return;
      }
      running = true;
      try {
        const now = new Date();
        const week = getIsoWeek(now);

        const existing = await db.coffeePair.findFirst({ where: { week } });
        if (existing) {
          logger.info(`coffeeRoulette: pairs already exist for week ${week}`);
          return;
        }

        const { pairs, oddUser } = await generatePairs(week);

        const channelIds = await getChannelIds();
        if (channelIds.coffeeRoulette) {
          const channel = await client.channels
            .fetch(channelIds.coffeeRoulette)
            .catch(() => null);

          if (channel && channel instanceof TextChannel) {
            const embedPairs = pairs.map((p) => ({
              user1: p.user1Username,
              user2: p.user2Username,
            }));

            if (oddUser) {
              embedPairs.push({ user1: oddUser.username, user2: null });
            }

            const embed = coffeeRouletteEmbed(embedPairs, week);
            await channel.send({
              content: "@everyone",
              embeds: [embed],
              allowedMentions: { parse: ["everyone"] },
            });
            logger.info("coffeeRoulette: posted to channel");
          } else {
            logger.warn("coffeeRoulette: channel not found or not text channel");
          }
        }

        for (const pair of pairs) {
          await awardPoints(
            pair.user1DiscordId,
            COFFEE_ROULETTE_POINTS,
            `Coffee Roulette participation (${week})`,
          );
          await awardPoints(
            pair.user2DiscordId as string,
            COFFEE_ROULETTE_POINTS,
            `Coffee Roulette participation (${week})`,
          );
          await awardCoffeeRouletteXp(pair.user1DiscordId, pair.user1Username);
          if (pair.user2DiscordId && pair.user2Username) {
            await awardCoffeeRouletteXp(pair.user2DiscordId, pair.user2Username);
          }
        }
      } catch (error) {
        logger.error("coffeeRoulette failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        running = false;
      }
    },
    { timezone: TIMEZONE },
  );
  logger.info("coffeeRoulette cron scheduled (0 12 * * 5)");
}
