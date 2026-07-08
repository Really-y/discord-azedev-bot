# Azedev OS — Architecture Document

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Dependencies](#2-tech-stack--dependencies)
3. [Project Structure](#3-project-structure)
4. [System Architecture](#4-system-architecture)
5. [Event-Driven Lifecycle](#5-event-driven-lifecycle)
6. [Command System](#6-command-system)
7. [Scheduled Tasks (Cron Jobs)](#7-scheduled-tasks-cron-jobs)
8. [Service Layer](#8-service-layer)
9. [AI Integration](#9-ai-integration)
10. [Database Design](#10-database-design)
11. [Configuration & Environment](#11-configuration--environment)
12. [Error Handling & Logging](#12-error-handling--logging)
13. [Code Conventions](#13-code-conventions)
14. [Testing Strategy](#14-testing-strategy)
15. [Deployment](#15-deployment)
16. [Getting Started](#16-getting-started)

---

## 1. Project Overview

**Azedev OS** is a community management and gamification Discord bot purpose-built for **Azedev**, a software collective and startup incubator.

### 1.1 Problem Statement

Discord communities frequently suffer from the "ghost server" problem: members join, lurk briefly, then disengage. Azedev OS solves this through three pillars:

| Pillar | Mechanism | Outcome |
|--------|-----------|---------|
| **Gamification** | AzC Points, XP, levels, leaderboards | Incentivizes helpful behavior and knowledge sharing |
| **Community Bonding** | Coffee Roulette (random pairings) | Builds personal connections between members |
| **AI-Driven Discussion** | Daily AI-generated questions | Keeps channels active with fresh, relevant content |

### 1.2 Brand & Tone

- **Output language:** All messages, embeds, and interactions sent to Discord MUST be in **Azerbaijani**.
- **Code language:** Variable names, comments, and internal identifiers — **English**.
- **Tone:** Realistic, professional, direct (branded internally as *"amansız reallıq"* — harsh reality). No toxic positivity, no empty motivational platitudes.

### 1.3 Guiding Principles

- **Strict modularity.** Every concern lives in its own module. No monolithic `index.ts`.
- **Fail gracefully.** AI failures must not break bot usability; fallbacks are mandatory.
- **Single source of truth.** The Prisma schema defines all data. No ad-hoc data structures.
- **Type safety first.** TypeScript strict mode is non-negotiable.

---

## 2. Tech Stack & Dependencies

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Runtime | Node.js | ≥ 20 LTS | Long-term support, stable `fetch` API |
| Language | TypeScript | ≥ 5.4 | Strict mode enabled; type safety across the codebase |
| Discord Framework | discord.js | v14 | Mature, well-documented, full Gateway/API coverage |
| Database | PostgreSQL (Supabase) | 15+ | Managed hosting, connection pooling, backups included |
| ORM | Prisma | ≥ 5.x | Type-safe queries, declarative schema, migration tooling |
| Task Scheduling | `node-cron` | ≥ 3.x | Lightweight cron syntax, no external daemon needed |
| Primary AI | `@google/genai` | latest | Gemini 2.5 Flash — fast, cost-effective, multilingual |
| Backup AI | `groq-sdk` | latest | Llama 3 8B — used strictly as a Gemini fallback |
| Development | `tsx` | latest | Fast TypeScript execution without build step in dev |
| Linting | ESLint + Prettier | latest | Consistent code style |

### 2.1 Dependency Philosophy

- Prefer the **fewest possible dependencies**. Every added package is a maintenance liability.
- No ORM other than Prisma. No secondary database.
- No framework wrapper on top of discord.js — use it directly.
- AI provider SDKs are the only third-party API clients.

---

## 3. Project Structure

```
/
├── src/
│   ├── commands/           # Slash command and prefix command handlers
│   │   ├── index.ts        # Command registry & deploy logic
│   │   ├── thanks.ts       # !təşəkkür prefix command
│   │   ├── profile.ts      # /profile slash command
│   │   ├── leaderboard.ts  # /leaderboard slash command
│   │   ├── help.ts         # /help slash command
│   │   └── daily.ts        # /daily slash command
│   │
│   ├── events/             # Discord Gateway event listeners
│   │   ├── index.ts        # Event registration & binding
│   │   ├── ready.ts        # on("ready") — startup, register commands, init cron
│   │   ├── messageCreate.ts      # on("messageCreate") — prefix commands, activity
│   │   └── interactionCreate.ts  # on("interactionCreate") — slash commands, buttons
│   │
│   ├── cron/               # Scheduled tasks (node-cron)
│   │   ├── index.ts        # Cron job registration
│   │   ├── dailyQuestion.ts
│   │   ├── coffeeRoulette.ts
│   │   └── inactivityReminder.ts
│   │
│   ├── services/           # Business logic layer
│   │   ├── database.ts     # Prisma client singleton
│   │   ├── ai.ts           # AI generation with fallback
│   │   ├── points.ts       # AzC Points awarding, deduction, ledger
│   │   ├── gamification.ts # XP, level-up, role management
│   │   └── roulette.ts     # Coffee Roulette pairing algorithm
│   │
│   ├── utils/              # Shared helpers
│   │   ├── logger.ts       # Structured logging
│   │   ├── constants.ts    # Magic numbers, role IDs, channel IDs, point values
│   │   ├── embedBuilder.ts # Standardized Discord embed templates
│   │   └── errorHandler.ts # Centralized error capture & user-facing messages
│   │
│   ├── types/              # Shared TypeScript types & interfaces
│   │   └── index.ts
│   │
│   └── index.ts            # Entry point — creates Client, loads events, starts bot
│
├── prisma/
│   └── schema.prisma       # Database schema (single source of truth)
│
├── .env                    # Environment variables (never committed)
├── .env.example            # Template for required env vars (committed)
├── .gitignore
├── .eslintrc.cjs
├── .prettierrc
├── tsconfig.json           # Strict TypeScript configuration
├── package.json
└── README.md
```

### 3.1 Module Boundaries

Each top-level directory under `src/` is a **self-contained boundary**. Rules:

- **`commands/`** may import from `services/` and `utils/`. May NOT import from `cron/` or `events/`.
- **`events/`** may import from `commands/`, `services/`, and `utils/`. May NOT import from `cron/`.
- **`cron/`** may import from `services/` and `utils/`. May NOT import from `commands/` or `events/`.
- **`services/`** may import from `utils/`. May NOT import from `commands/`, `events/`, or `cron/`.
- **`utils/`** may NOT import from any other `src/` directory — it is the leaf layer.
- **`types/`** is importable by any module. It must not contain runtime code (only `type` and `interface`).

These boundaries prevent circular dependencies and enforce a clean layered architecture.

---

## 4. System Architecture

### 4.1 High-Level Data Flow

```
┌──────────────────────────────────────────────────────────┐
│                      Discord Gateway                      │
│                                                          │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────┐ │
│  │  Messages    │  │  Interactions  │  │  Presence     │ │
│  │  (prefix)    │  │  (slash, btn)  │  │  Updates      │ │
│  └──────┬───────┘  └───────┬────────┘  └──────┬───────┘ │
└─────────┼──────────────────┼──────────────────┼─────────┘
          │                  │                  │
          ▼                  ▼                  ▼
   ┌────────────┐   ┌────────────────┐   (ignored)
   │ events/    │   │ events/        │
   │ message    │   │ interaction    │
   │ Create.ts  │   │ Create.ts      │
   └─────┬──────┘   └───────┬────────┘
         │                  │
         ▼                  ▼
   ┌────────────┐   ┌────────────────┐
   │ commands/  │   │ commands/      │
   │ (prefix)   │   │ (slash)        │
   └─────┬──────┘   └───────┬────────┘
         │                  │
         └────────┬─────────┘
                  │
                  ▼
         ┌────────────────┐
         │   services/    │
         │  (business     │
         │   logic)       │
         └───────┬────────┘
                 │
         ┌───────┴────────┐
         ▼                ▼
   ┌──────────┐    ┌──────────────┐
   │ Prisma   │    │  AI APIs     │
   │ (Supabase│    │ (Gemini/Groq)│
   │  PG)     │    │              │
   └──────────┘    └──────────────┘
```

### 4.2 Cron Job Flow

```
┌───────────────────────────────────────────────┐
│                  node-cron                     │
│                                                │
│  ┌──────────────┐ ┌──────────────┐            │
│  │ dailyQuestion│ │coffeeRoulette│  ...       │
│  │ (10:00)      │ │ (Fri 12:00)  │            │
│  └──────┬───────┘ └──────┬───────┘            │
└─────────┼────────────────┼────────────────────┘
          │                │
          ▼                ▼
   ┌────────────┐   ┌──────────────┐
   │ services/  │   │ services/    │
   │ ai.ts      │   │ roulette.ts  │
   │ (generate  │   │ (pair users) │
   │  question) │   │              │
   └─────┬──────┘   └──────┬───────┘
         │                 │
         ▼                 ▼
   ┌────────────┐   ┌──────────────┐
   │ Prisma     │   │ Prisma       │
   │ (store     │   │ (store pair) │
   │  question) │   │              │
   └────────────┘   └──────────────┘
         │                 │
         ▼                 ▼
   ┌────────────────────────────────┐
   │   Discord API                  │
   │   (post to designated channel) │
   └────────────────────────────────┘
```

---

## 5. Event-Driven Lifecycle

The bot follows the standard discord.js event-driven model. Events are registered once at startup.

### 5.1 Startup Sequence (`ready` event)

```
1. Discord Client login(DISCORD_TOKEN)
2. Gateway connection established
3. "ready" event fires
   3a. Register slash commands with Discord API (production: globally; dev: per-guild)
   3b. Initialize Prisma client (connect)
   3c. Start all cron jobs
   3d. Log startup summary (guild count, command count, cron status)
   3e. Set bot presence/status
4. Bot is now operational
```

**Implementation pattern (pseudocode):**

```typescript
// src/events/ready.ts
import { Events } from "discord.js";
import type { Client } from "discord.js";
import { registerCommands } from "../commands";
import { startAllCronJobs } from "../cron";
import { db } from "../services/database";
import { logger } from "../utils/logger";

export const readyEvent = {
  name: Events.ClientReady,
  once: true,
  async execute(client: Client<true>) {
    logger.info(`Logged in as ${client.user.tag}`);

    await db.$connect();
    logger.info("Database connected");

    await registerCommands(client);
    logger.info("Commands registered");

    startAllCronJobs(client);
    logger.info("Cron jobs started");

    client.user.setActivity("Azərbaycan İT icması", { type: 3 }); // "Watching"
  },
};
```

### 5.2 `messageCreate` Event

Handles **prefix commands only** (slash commands are handled by `interactionCreate`).

**Processing flow:**

1. Ignore messages from bots (including self).
2. Check if message starts with the prefix (`!`).
3. Extract command name and arguments.
4. Route to the appropriate command handler in `commands/`.
5. If no command matches, silently return (do not reply to unknown prefixes).
6. On each message, update the sender's `lastActive` timestamp for activity tracking.

### 5.3 `interactionCreate` Event

Handles all **slash commands**, **buttons**, **select menus**, and **modals**.

**Processing flow:**

1. If interaction is a `ChatInputCommandInteraction` → route to slash command handler.
2. If interaction is a `ButtonInteraction` → route to button handler (if any registered).
3. If interaction is an `AutocompleteInteraction` → route to autocomplete handler.
4. Defer reply immediately if processing will exceed 3 seconds.
5. Wrap all handler execution in try/catch — reply with a user-friendly Azerbaijani error message on failure.

---

## 6. Command System

### 6.1 Command Structure

Each command module exports a standard interface:

```typescript
// Conceptual interface — documented for clarity, not a literal source file
interface SlashCommand {
  data: SlashCommandBuilder;            // discord.js command definition
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
}

interface PrefixCommand {
  name: string;
  aliases?: string[];
  description: string;
  execute(message: Message, args: string[]): Promise<void>;
}
```

### 6.2 Slash Commands

| Command | Options | Description |
|---------|---------|-------------|
| `/profile` | `user` (optional) | Display AzC Points, XP, level, and activity stats. If no user specified, shows own profile. |
| `/leaderboard` | None | Top contributors ranked by AzC Points (descending). Paginated embed. |
| `/help` | None | Bot usage guide with command list and descriptions. |
| `/daily` | `action` (optional: `view` / `trigger`) | View today's question or manually trigger a new one (admin-only for `trigger`). |

### 6.3 Prefix Commands

| Command | Description |
|---------|-------------|
| `!təşəkkür @user` | Award 10 AzC Points to the mentioned user. Cannot thank yourself or bots. Cooldown: once per user per hour. |

### 6.4 Command Registration

- **Development:** Commands are registered to a single guild (specified via `DISCORD_GUILD_ID`) for instant updates — no 1-hour propagation delay.
- **Production:** Commands are registered globally. Slash commands may take up to 1 hour to propagate.
- Registration happens in `ready.ts` via a call to `registerCommands()` in `commands/index.ts`.

### 6.5 Prefix Command Parser

The `messageCreate` event uses a simple parser:

```typescript
// Conceptual pattern
const PREFIX = "!";

function parsePrefixCommand(content: string): { name: string; args: string[] } | null {
  if (!content.startsWith(PREFIX)) return null;
  const parts = content.slice(PREFIX.length).trim().split(/\s+/);
  return { name: parts[0]?.toLowerCase(), args: parts.slice(1) };
}
```

### 6.6 Command Cooldowns

Implement a simple in-memory cooldown map at the command handler level:

```typescript
// Conceptual pattern — cooldown per user+command
const cooldowns = new Map<string, number>();

function isOnCooldown(userId: string, command: string, ms: number): boolean {
  const key = `${command}:${userId}`;
  const lastUsed = cooldowns.get(key);
  if (lastUsed && Date.now() - lastUsed < ms) return true;
  cooldowns.set(key, Date.now());
  return false;
}
```

---

## 7. Scheduled Tasks (Cron Jobs)

Managed by `node-cron`. All jobs are registered in `src/cron/index.ts` and started during the `ready` event.

| Job | Cron Expression | Description |
|-----|----------------|-------------|
| `dailyQuestion` | `0 10 * * *` (10:00 AM daily) | Generates an Azerbaijani discussion question via AI and posts to `DAILY_QUESTION_CHANNEL_ID`. |
| `coffeeRoulette` | `0 12 * * 5` (Friday noon) | Pairs random active members, posts pairings to `COFFEE_ROULETTE_CHANNEL_ID`. |
| `inactivityReminder` | `0 9 * * 1` (Monday 9 AM) | DMs members inactive for >7 days with a re-engagement message. |

### 7.1 Cron Job Implementation Pattern

```typescript
// Conceptual pattern for each cron job
import cron from "node-cron";
import type { Client } from "discord.js";

export function startDailyQuestion(client: Client): void {
  cron.schedule("0 10 * * *", async () => {
    try {
      // 1. Generate question via AI service
      // 2. Store question in database
      // 3. Post embed to designated channel
      // 4. Log success
    } catch (error) {
      // Log error; never let a cron failure crash the bot
      logger.error("dailyQuestion failed", error);
    }
  });
}
```

### 7.2 Cron Safety Rules

- All cron handlers MUST be wrapped in try/catch. A single cron failure must not crash the bot process.
- Cron jobs must not overlap. If a job is still running when its next tick is due, skip that tick (use a lock flag: `let running = false` at the top of the handler).
- Use the `timezone` option in `node-cron` to ensure schedules align with the server's timezone (configure via env var).

---

## 8. Service Layer

Services contain all business logic. They are stateless (except for the Prisma singleton) and consume dependencies via imports.

### 8.1 Database Service (`services/database.ts`)

Exports a **singleton Prisma client instance**. Never create multiple Prisma clients.

```typescript
// src/services/database.ts
import { PrismaClient } from "@prisma/client";

export const db = new PrismaClient({
  log: process.env.NODE_ENV === "development"
    ? ["query", "warn", "error"]
    : ["error"],
});
```

**Rules:**
- Only `services/` files may import `db` directly. `commands/`, `events/`, and `cron/` go through service functions.
- On shutdown, call `await db.$disconnect()` (handled in `index.ts` via process signal handlers).

### 8.2 Points Service (`services/points.ts`)

Handles all AzC Points operations with a **double-entry ledger** pattern.

**Operations:**

| Function | Description |
|----------|-------------|
| `awardPoints(userId, amount, description)` | Adds points, creates a Transaction record |
| `deductPoints(userId, amount, description)` | Subtracts points (prevents negative balance), creates a Transaction record |
| `getBalance(userId)` | Returns current point balance |
| `getTransactionHistory(userId, limit?)` | Returns paginated transaction log |

**Safety rule:** Always use a Prisma transaction when modifying point balances to ensure atomicity:

```typescript
// Conceptual pattern for atomic point operations
async function awardPoints(userId: string, amount: number, description: string): Promise<void> {
  await db.$transaction([
    db.user.update({
      where: { discordId: userId },
      data: { azcPoints: { increment: amount } },
    }),
    db.transaction.create({
      data: { userId, amount, type: "EARN", description },
    }),
  ]);
}
```

### 8.3 Gamification Service (`services/gamification.ts`)

Handles XP, level progression, and role assignments.

**XP Sources:**

| Action | XP Awarded |
|--------|------------|
| Sending a message (non-command) | 1 XP (cooldown: 1 per minute) |
| Receiving a `!təşəkkür` | 5 XP |
| Participating in daily question | 3 XP |
| Coffee Roulette participation | 10 XP |

**Level Formula:**

```
Level = floor(sqrt(totalXP / 100)) + 1
XP required for next level = ((level) ^ 2) * 100
```

This is a quadratic curve — early levels are fast, later levels require exponentially more engagement.

**Role Assignment:**
- Level 5 → `@Aktiv Üzv` role
- Level 10 → `@Veteran` role
- Level 20 → `@Elit` role

### 8.4 Roulette Service (`services/roulette.ts`)

The Coffee Roulette pairing algorithm:

1. Query all users who have been active in the last 14 days.
2. Exclude users who have opted out (future feature — currently not implemented).
3. Exclude users who were paired in the last 4 weeks.
4. Shuffle the remaining users randomly (Fisher-Yates).
5. Pair users sequentially (e.g., [A, B, C, D] → pairs (A,B), (C,D)).
6. If odd count, the last user gets a "wildcard" mention or is skipped.
7. Store each pair in the `CoffeePair` table.
8. Post pairings as embeds in the designated channel.

---

## 9. AI Integration

### 9.1 Architecture

The AI service (`services/ai.ts`) provides a **unified interface** with automatic failover:

```
                    ┌──────────────────────┐
                    │    ai.generate()     │
                    │    (unified call)    │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  Try Gemini first     │
                    │  (@google/genai)     │
                    └──────────┬──────────┘
                               │
                    ┌─────success?────────┐
                    │                     │
                    ▼ YES                 ▼ NO
               return result    ┌──────────────────┐
                                │  Try Groq fallback│
                                │  (groq-sdk)       │
                                └────────┬─────────┘
                                         │
                              ┌─────success?──────────┐
                              │                        │
                              ▼ YES                    ▼ NO
                         return result          return error
                                                (graceful fallback)
```

### 9.2 Service Interface

```typescript
// Conceptual interface
class AIService {
  /**
   * Generate a daily discussion question in Azerbaijani.
   * Falls back from Gemini → Groq automatically.
   */
  async generateDailyQuestion(topic?: string): Promise<string>;

  /**
   * Generic text generation with the brand tone preset.
   * Used internally — not exposed to commands directly.
   */
  private async generate(prompt: string): Promise<string>;
}
```

### 9.3 Prompt Engineering Rules

All prompts must include these instructions within the system message:

```
- Respond in Azerbaijani language only
- Tone: professional, realistic, direct ("amansız reallıq")
- Avoid motivational clichés, toxic positivity, and generic encouragement
- Keep responses concise and substantive
```

For daily questions specifically, the prompt should also instruct:

```
- Generate a discussion question about software development, startups, or technology
- The question should spark debate or critical thinking
- Do NOT include an answer — only the question
- One question only, no preamble
```

### 9.4 Retry & Timeout Strategy

| Parameter | Gemini | Groq |
|-----------|--------|------|
| Timeout | 15 seconds | 10 seconds |
| Retries | 1 immediate retry | 0 (it is the fallback) |
| Backoff | None (fast fail) | N/A |

If both providers fail, the caller receives a `null` or throws an `AIServiceError`. The consumer (command or cron) must handle this gracefully — e.g., post a static fallback question or notify an admin.

### 9.5 AI Error Handling

```typescript
// Conceptual pattern
export class AIServiceError extends Error {
  constructor(
    message: string,
    public readonly provider: "gemini" | "groq",
    public readonly originalError: unknown,
  ) {
    super(message);
    this.name = "AIServiceError";
  }
}
```

---

## 10. Database Design

### 10.1 Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id             String              @id @default(uuid())
  discordId      String              @unique
  username       String
  azcPoints      Int                 @default(0)
  xp             Int                 @default(0)
  level          Int                 @default(1)
  lastActive     DateTime?
  createdAt      DateTime            @default(now())
  updatedAt      DateTime            @updatedAt
  transactions   Transaction[]
  participations DailyParticipation[]
}

model Transaction {
  id          String          @id @default(uuid())
  userId      String
  user        User            @relation(fields: [userId], references: [id])
  amount      Int
  type        TransactionType
  description String?
  createdAt   DateTime        @default(now())
}

enum TransactionType {
  EARN
  SPEND
  TRANSFER
}

model DailyQuestion {
  id             String               @id @default(uuid())
  question       String
  date           DateTime             @unique
  createdBy      String               // "AI" or "manual"
  createdAt      DateTime             @default(now())
  participations DailyParticipation[]
}

model DailyParticipation {
  id         String        @id @default(uuid())
  userId     String
  user       User          @relation(fields: [userId], references: [id])
  questionId String
  question   DailyQuestion @relation(fields: [questionId], references: [id])
  response   String
  createdAt  DateTime      @default(now())
}

model CoffeePair {
  id       String   @id @default(uuid())
  user1Id  String
  user2Id  String
  pairedAt DateTime @default(now())
  week     String   // ISO week identifier, e.g. "2026-W28"
}
```

### 10.2 Schema Design Decisions

- **UUIDs over auto-increment.** Prevents enumeration attacks and simplifies distributed scenarios.
- **Int for points/XP.** SQL `Int` (4 bytes, ±2.1B range) is more than sufficient. No need for `BigInt`.
- **`TransactionType` enum.** Guarantees only valid transaction types exist in the database.
- **Unique `date` on `DailyQuestion`.** Ensures exactly one question per calendar day.
- **ISO week on `CoffeePair`.** Enables easy querying: "who was paired in week 28?"

### 10.3 Indexing Strategy

For expected query patterns, ensure indexes exist:

| Table | Column(s) | Reason |
|-------|-----------|--------|
| `User` | `discordId` | Primary lookup key (already `@unique`) |
| `User` | `azcPoints` (DESC) | Leaderboard queries |
| `Transaction` | `userId` + `createdAt` | Transaction history with pagination |
| `DailyParticipation` | `userId` + `questionId` | Check if user already answered |
| `CoffeePair` | `user1Id`, `user2Id` | Check recent pairings |

Prisma creates indexes automatically for `@unique` and `@id` fields. For composite or sort indexes, use `@@index` attributes in the schema.

### 10.4 Migration Workflow

```bash
# After editing schema.prisma:
npx prisma migrate dev --name <descriptive-name>

# Apply migrations in production:
npx prisma migrate deploy

# Regenerate typed client:
npx prisma generate
```

Never edit migration files manually. Never reset the production database with `prisma migrate reset`.

---

## 11. Configuration & Environment

### 11.1 `.env` Variables

```env
# ── Discord ──────────────────────────────────
DISCORD_TOKEN=            # Bot token from Discord Developer Portal
DISCORD_CLIENT_ID=        # Application ID
DISCORD_GUILD_ID=         # Server ID (dev: for guild-level command registration)

# ── Database (Supabase PostgreSQL) ───────────
DATABASE_URL=             # postgresql://user:pass@host:5432/db?pgbouncer=true

# ── AI APIs ──────────────────────────────────
GEMINI_API_KEY=           # Google AI Studio API key
GROQ_API_KEY=             # Groq Cloud API key

# ── Discord Channel IDs ──────────────────────
DAILY_QUESTION_CHANNEL_ID=
COFFEE_ROULETTE_CHANNEL_ID=
LEADERBOARD_CHANNEL_ID=

# ── Points Configuration ─────────────────────
THANKS_POINTS=10
DAILY_PARTICIPATION_POINTS=5
COFFEE_ROULETTE_POINTS=15

# ── Optional ─────────────────────────────────
NODE_ENV=development      # development | production
LOG_LEVEL=info            # error | warn | info | debug
TIMEZONE=Asia/Baku        # For cron job scheduling
```

### 11.2 Configuration Loading

- Use `process.env` directly for simple variables. No heavy config library needed.
- Validate required variables at startup:

```typescript
// Conceptual pattern — in index.ts during startup
const REQUIRED_ENV_VARS = [
  "DISCORD_TOKEN",
  "DISCORD_CLIENT_ID",
  "DATABASE_URL",
  "GEMINI_API_KEY",
  "GROQ_API_KEY",
] as const;

for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}
```

- Values from `.env` are strings. Parse integers explicitly: `parseInt(process.env.THANKS_POINTS, 10)`.

---

## 12. Error Handling & Logging

### 12.1 Error Handling Philosophy

- **Never crash on Discord API errors.** Wrap all event handlers in try/catch.
- **Never crash on database errors.** Retry transient errors; log permanent ones.
- **Never expose raw errors to users.** Always return a friendly Azerbaijani message.
- **Always log the full error** (stack trace, context) for debugging.

### 12.2 Error Handler Utility

```typescript
// Conceptual pattern — src/utils/errorHandler.ts
import { logger } from "./logger";

export function handleError(
  context: string,
  error: unknown,
  userFacingMessage?: string,
): string {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  logger.error(`[${context}] ${message}`, { stack });

  // Return a user-safe message
  return (
    userFacingMessage ??
    "Xəta baş verdi. Zəhmət olmasa bir az sonra yenidən cəhd edin."
  );
}
```

### 12.3 Logger (`utils/logger.ts`)

Use a simple structured logger. Recommended implementation: a thin wrapper around `console` with timestamp and log level:

```typescript
// Conceptual pattern
const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 } as const;

type LogLevel = keyof typeof LOG_LEVELS;

function log(level: LogLevel, message: string, meta?: unknown): void {
  const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL as LogLevel] ?? LOG_LEVELS.info;
  if (LOG_LEVELS[level] > currentLevel) return;

  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  console[level === "error" ? "error" : "log"](
    `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`,
  );
}

export const logger = {
  error: (msg: string, meta?: unknown) => log("error", msg, meta),
  warn: (msg: string, meta?: unknown) => log("warn", msg, meta),
  info: (msg: string, meta?: unknown) => log("info", msg, meta),
  debug: (msg: string, meta?: unknown) => log("debug", msg, meta),
};
```

### 12.4 Graceful Shutdown

Handle process termination signals to close connections cleanly:

```typescript
// Conceptual pattern — in src/index.ts
const shutdown = async (signal: string) => {
  logger.info(`${signal} received. Shutting down...`);
  await db.$disconnect();
  client.destroy();
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
```

---

## 13. Code Conventions

### 13.1 TypeScript Configuration

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

Key flags:
- **`strict: true`** — Enables all strict type-checking options. Non-negotiable.
- **`moduleResolution: "bundler"`** — Compatible with `tsx` for development.

### 13.2 Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | `camelCase.ts` | `embedBuilder.ts` |
| Functions | `camelCase` | `awardPoints()`, `generateDailyQuestion()` |
| Variables | `camelCase` | `userPoints`, `channelId` |
| Constants | `UPPER_SNAKE_CASE` | `THANKS_POINTS`, `MAX_LEADERBOARD_SIZE` |
| Types/Interfaces | `PascalCase` | `SlashCommand`, `UserProfile` |
| Prisma models | `PascalCase` | `User`, `DailyQuestion` |
| Database columns | `camelCase` | `azcPoints`, `lastActive` |

### 13.3 Import Order

Standardize import ordering:
1. Node.js built-ins (`node:crypto`, `node:path`)
2. External packages (`discord.js`, `@prisma/client`, `node-cron`)
3. Internal modules — services first, then utils (`../services/database`, `../utils/logger`)
4. Types (`../types`)

### 13.4 Async Patterns

- Use `async/await` exclusively. Never raw `Promise.then/catch`.
- Always `await` promises — no floating promises.
- Use `Promise.all()` for parallel independent operations.
- Use `Promise.allSettled()` when partial failures are acceptable.

### 13.5 Discord-Specific Conventions

- **Embeds:** Always use the `embedBuilder.ts` utility. Never construct raw `EmbedBuilder` instances in command files.
- **Ephemeral replies:** Use for error messages and private information. Use public replies for content that benefits the community.
- **Deferrals:** If a command handler takes >3 seconds, defer the reply immediately at the start of the handler.
- **Permissions:** Check permissions before executing. Return a clear Azerbaijani error if the bot lacks required permissions.

---

## 14. Testing Strategy

### 14.1 Testing Layers

| Layer | Tool | Scope |
|-------|------|-------|
| Unit tests | Vitest (or Jest) | Services, utils, pure logic |
| Integration tests | Vitest + Prisma test DB | Database operations, AI service with mocked API |
| E2E (optional) | Manual or Discord mock | Full command flow |

### 14.2 What to Test

- **Points Service:** Award, deduct, ledger integrity, negative balance prevention.
- **Gamification Service:** Level calculation, XP thresholds, role eligibility.
- **Roulette Service:** Pairing logic, exclusion rules, odd-count handling.
- **AI Service:** Fallback behavior (mock Gemini failure → verify Groq is called).
- **Command parsers:** Prefix parsing, argument extraction.
- **Error Handler:** All error paths return user-safe messages.

### 14.3 Testing Prisma

- Use a **separate test database** (configured via `DATABASE_URL` in `.env.test`).
- Use `prisma migrate deploy` before tests, not `migrate dev`.
- Clean the database between test suites (truncate all tables).
- Never test against the production database.

---

## 15. Deployment

### 15.1 Recommended Hosting

| Option | Pros | Cons |
|--------|------|------|
| **Railway** | Simple deploys, PostgreSQL included, generous free tier | Limited regions |
| **Fly.io** | Global edge, scale-to-zero | More complex setup |
| **VPS (Hetzner, DigitalOcean)** | Full control, cheapest at scale | Manual setup, no managed DB |

Supabase provides the managed PostgreSQL database in all scenarios.

### 15.2 Production Checklist

- [ ] `NODE_ENV=production` set
- [ ] Slash commands registered globally (not guild-only)
- [ ] `LOG_LEVEL=warn` (or `error`) to reduce noise
- [ ] Cron timezone set to `Asia/Baku`
- [ ] Database connection uses Supabase connection pooler (PgBouncer — `?pgbouncer=true` in connection string)
- [ ] `DISCORD_TOKEN` rotated if ever exposed
- [ ] `.env` excluded from version control
- [ ] Process manager configured (PM2, systemd, or platform-native)

### 15.3 Running in Production

```bash
# Build TypeScript
npm run build

# Deploy migrations
npx prisma migrate deploy

# Start
node dist/index.js
```

---

## 16. Getting Started

### 16.1 Prerequisites

- Node.js ≥ 20
- npm ≥ 10
- PostgreSQL database (local or Supabase)
- Discord Bot Application (with token, client ID)
- Gemini API key (Google AI Studio)
- Groq API key (Groq Cloud)

### 16.2 First-Time Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd azedev-bot
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your actual values

# 3. Set up database
npx prisma generate
npx prisma migrate dev --name init

# 4. Start development server
npm run dev
```

### 16.3 Available Scripts

```jsonc
// package.json scripts
{
  "dev": "tsx watch src/index.ts",      // Hot-reload development
  "build": "tsc",                        // Compile TypeScript
  "start": "node dist/index.js",         // Run compiled output
  "db:migrate": "npx prisma migrate dev",
  "db:deploy": "npx prisma migrate deploy",
  "db:generate": "npx prisma generate",
  "db:studio": "npx prisma studio",      // Visual DB browser
  "lint": "eslint src/",
  "lint:fix": "eslint --fix src/",
  "format": "prettier --write src/",
  "test": "vitest",
  "test:watch": "vitest --watch"
}
```

### 16.4 Inviting the Bot to Your Server

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=412317173824&scope=bot%20applications.commands
```

Required permissions:
- Send Messages
- Embed Links
- Read Message History
- Use Slash Commands
- Mention @everyone (for Coffee Roulette announcements)
- Manage Roles (for level-based role assignment)

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **AzC Points** | The community currency. Earned by helping others, participating in discussions, and community events. |
| **Coffee Roulette** | Weekly random pairing of two community members for a virtual coffee chat. |
| **amansız reallıq** | "Harsh reality" — the brand tone directive. Professional, direct, no fluff. |
| **Ghost server** | A Discord server where members join but never interact — the core problem Azedev OS solves. |

---

## Appendix B: Future Considerations (Out of Scope)

The following are NOT part of the current architecture but may be considered in future iterations:

- Shop system for spending AzC Points (roles, perks)
- Automated moderation (anti-spam, profanity filter)
- Web dashboard for community analytics
- Integration with Azedev's startup incubator workflow

---

*This architecture document is the definitive reference for Azedev OS development. All implementation decisions should trace back to the patterns and rules described here. When in doubt, refer to this document first.*
