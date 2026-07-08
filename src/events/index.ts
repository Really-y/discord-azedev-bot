import type { Client } from "discord.js";
import type { BotEvent } from "../types";
import { readyEvent } from "./ready";
import { messageCreateEvent } from "./messageCreate";
import { interactionCreateEvent } from "./interactionCreate";
import { logger } from "../utils/logger";

const events: BotEvent[] = [
  readyEvent as BotEvent,
  messageCreateEvent as BotEvent,
  interactionCreateEvent as BotEvent,
];

export function registerEvents(client: Client): void {
  for (const event of events) {
    const handler = (...args: unknown[]) => {
      try {
        const result = event.execute(...args);
        if (result instanceof Promise) {
          result.catch((error: unknown) => {
            logger.error(`[event:${event.name}] unhandled error`, {
              error: error instanceof Error ? error.message : String(error),
            });
          });
        }
      } catch (error) {
        logger.error(`[event:${event.name}] sync error`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    if (event.once) {
      client.once(event.name, handler);
    } else {
      client.on(event.name, handler);
    }
  }
  logger.info(`Registered ${events.length} event listeners`);
}
