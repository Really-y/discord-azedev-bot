import cron from "node-cron";
import type { Client } from "discord.js";
import { db } from "../services/database";
import { logger } from "../utils/logger";
import { INACTIVITY_THRESHOLD_DAYS, TIMEZONE } from "../utils/constants";

let running = false;

const RE_ENGAGEMENT_MESSAGE =
  "We haven't seen you in a while! The Azedev community is waiting for you. " +
  "Reply to today's question, join Coffee Roulette, or just say hi. " +
  "Staying active is the key to growth. See you around! ☕";

export function startInactivityReminder(client: Client): void {
  cron.schedule(
    "0 9 * * 1",
    async () => {
      if (running) {
        logger.warn("inactivityReminder: previous run still active, skipping");
        return;
      }
      running = true;
      try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - INACTIVITY_THRESHOLD_DAYS);

        const inactiveUsers = await db.user.findMany({
          where: {
            lastActive: { lt: cutoff },
          },
          select: { discordId: true, username: true },
        });

        if (inactiveUsers.length === 0) {
          logger.info("inactivityReminder: no inactive users found");
          return;
        }

        logger.info(`inactivityReminder: notifying ${inactiveUsers.length} users`);

        let notified = 0;
        for (const user of inactiveUsers) {
          try {
            const discordUser = await client.users.fetch(user.discordId);
            await discordUser.send(RE_ENGAGEMENT_MESSAGE);
            notified++;
          } catch (error) {
            logger.warn(`inactivityReminder: could not DM ${user.discordId}`, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        logger.info(`inactivityReminder: notified ${notified}/${inactiveUsers.length} users`);
      } catch (error) {
        logger.error("inactivityReminder failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        running = false;
      }
    },
    { timezone: TIMEZONE },
  );
  logger.info("inactivityReminder cron scheduled (0 9 * * 1)");
}
