export const PREFIX = "!";

export const THANKS_POINTS = parseInt(process.env.THANKS_POINTS ?? "10", 10);
export const DAILY_PARTICIPATION_POINTS = parseInt(
  process.env.DAILY_PARTICIPATION_POINTS ?? "5",
  10);
export const COFFEE_ROULETTE_POINTS = parseInt(
  process.env.COFFEE_ROULETTE_POINTS ?? "15",
  10,
);

export const THANKS_COOLDOWN_MS = 60 * 60 * 1000;
export const XP_MESSAGE_COOLDOWN_MS = 60 * 1000;

export const XP_VALUES = {
  message: 1,
  thanksReceived: 5,
  dailyParticipation: 3,
  coffeeRoulette: 10,
} as const;

export const ROLE_THRESHOLDS = {
  activ: 5,
  veteran: 10,
  elit: 20,
} as const;

export const ROLE_IDS = {
  activ: process.env.ACTIV_MEMBER_ROLE_ID ?? "",
  veteran: process.env.VETERAN_ROLE_ID ?? "",
  elit: process.env.ELIT_ROLE_ID ?? "",
} as const;

export const CHANNEL_IDS = {
  dailyQuestion: process.env.DAILY_QUESTION_CHANNEL_ID ?? "",
  coffeeRoulette: process.env.COFFEE_ROULETTE_CHANNEL_ID ?? "",
  leaderboard: process.env.LEADERBOARD_CHANNEL_ID ?? "",
} as const;

export const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const TIMEZONE = process.env.TIMEZONE ?? "Asia/Baku";

export const MAX_LEADERBOARD_SIZE = 25;
export const LEADERBOARD_PAGE_SIZE = 10;

export const ROULETTE_ACTIVE_WINDOW_DAYS = 14;
export const ROULETTE_RECENT_PAIR_WEEKS = 4;
export const INACTIVITY_THRESHOLD_DAYS = 7;

export const BOT_STATUS_TEXT = "Azedev Community";

export const FALLBACK_DAILY_QUESTIONS = [
  "What's the most important skill for a developer — deep technical knowledge or effective communication?",
  "What's the biggest threat to a startup: lack of market fit or team misalignment?",
  "How do you balance speed and quality when writing code?",
  "Do open source projects provide real career benefits, or are they just a hobby?",
  "What's the hardest stage when learning a new technology?",
];

export const USER_FACING_ERRORS = {
  generic: "An error occurred. Please try again later.",
  selfThanks: "You cannot thank yourself. That's just needing an audience.",
  botThanks: "Cannot thank bots. They don't appreciate it.",
  cooldown: "Please wait a bit before using this command again.",
  noMention: "Please mention the user you want to thank.",
  noPermission: "You don't have permission to use this command.",
  userNotFound: "User not found.",
  noQuestionToday: "No question has been created for today yet.",
  aiUnavailable: "AI service is currently unavailable. Please try again later.",
} as const;
