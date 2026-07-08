import type {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  Message,
} from "discord.js";

export interface BotEvent {
  name: string;
  once?: boolean;
  execute: (...args: unknown[]) => void | Promise<void>;
}

export interface SlashCommand {
  data: SlashCommandBuilder;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
}

export interface PrefixCommand {
  name: string;
  aliases?: string[];
  description: string;
  execute(message: Message, args: string[]): Promise<void>;
}

export interface UserProfile {
  discordId: string;
  username: string;
  azcPoints: number;
  xp: number;
  level: number;
  lastActive: Date | null;
}

export interface LeaderboardEntry {
  discordId: string;
  username: string;
  azcPoints: number;
  level: number;
  rank: number;
}

export interface CoffeePairResult {
  user1DiscordId: string;
  user2DiscordId: string | null;
  user1Username: string;
  user2Username: string | null;
}

export interface DailyQuestionRecord {
  id: string;
  question: string;
  date: Date;
  createdBy: string;
}
