import { Client, GatewayIntentBits, Partials } from "discord.js";
import { registerEvents } from "./events";
import { db } from "./services/database";
import { logger } from "./utils/logger";

const REQUIRED_ENV_VARS = [
  "DISCORD_TOKEN",
  "DISCORD_CLIENT_ID",
  "DATABASE_URL",
  "GEMINI_API_KEY",
  "GROQ_API_KEY",
] as const;

function validateEnv(): void {
  const missing: string[] = [];
  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User],
});

const shutdown = async (signal: string): Promise<void> => {
  logger.info(`${signal} received. Shutting down...`);
  try {
    await db.$disconnect();
    logger.info("Database disconnected");
  } catch (error) {
    logger.error("Error disconnecting database", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  client.destroy();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", {
    error: error.message,
    stack: error.stack,
  });
});

async function main(): Promise<void> {
  validateEnv();
  registerEvents(client);

  const token = process.env.DISCORD_TOKEN as string;
  await client.login(token);
}

void main().catch((error) => {
  logger.error("Fatal startup error", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
