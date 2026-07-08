import { EmbedBuilder, type ColorResolvable } from "discord.js";

const BRAND_COLOR: ColorResolvable = 0x57f287;
const ERROR_COLOR: ColorResolvable = 0xed4245;
const WARNING_COLOR: ColorResolvable = 0xfeeb56;
const INFO_COLOR: ColorResolvable = 0x5865f2;

const FOOTER_TEXT = "Azedev OS";

function baseEmbed(color: ColorResolvable): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color)
    .setFooter({ text: FOOTER_TEXT })
    .setTimestamp();
}

export function successEmbed(title: string, description?: string): EmbedBuilder {
  const embed = baseEmbed(BRAND_COLOR).setTitle(`✅ ${title}`);
  if (description) embed.setDescription(description);
  return embed;
}

export function errorEmbed(title: string, description?: string): EmbedBuilder {
  const embed = baseEmbed(ERROR_COLOR).setTitle(`❌ ${title}`);
  if (description) embed.setDescription(description);
  return embed;
}

export function warningEmbed(title: string, description?: string): EmbedBuilder {
  const embed = baseEmbed(WARNING_COLOR).setTitle(`⚠️ ${title}`);
  if (description) embed.setDescription(description);
  return embed;
}

export function infoEmbed(title: string, description?: string): EmbedBuilder {
  const embed = baseEmbed(INFO_COLOR).setTitle(title);
  if (description) embed.setDescription(description);
  return embed;
}

export function brandEmbed(title: string, description?: string): EmbedBuilder {
  const embed = baseEmbed(BRAND_COLOR).setTitle(title);
  if (description) embed.setDescription(description);
  return embed;
}

export function profileEmbed(fields: {
  username: string;
  azcPoints: number;
  xp: number;
  level: number;
  nextLevelXp: number;
  rank: number | null;
  lastActive: Date | null;
  avatarURL?: string;
}): EmbedBuilder {
  const embed = baseEmbed(BRAND_COLOR)
    .setTitle(`Profile: ${fields.username}`)
    .addFields(
      { name: "AzC Points", value: `**${fields.azcPoints}**`, inline: true },
      { name: "Level", value: `**${fields.level}**`, inline: true },
      {
        name: "Experience (XP)",
        value: `${fields.xp} / ${fields.nextLevelXp}`,
        inline: true,
      },
    );

  if (fields.rank !== null) {
    embed.addFields({
      name: "Rank",
      value: `#${fields.rank}`,
      inline: true,
    });
  }

  embed.addFields({
    name: "Last Active",
    value: fields.lastActive
      ? `<t:${Math.floor(fields.lastActive.getTime() / 1000)}:R>`
      : "Never",
    inline: true,
  });

  if (fields.avatarURL) {
    embed.setThumbnail(fields.avatarURL);
  }

  return embed;
}

export function leaderboardEmbed(
  entries: { rank: number; username: string; azcPoints: number; level: number }[],
  page: number,
  totalPages: number,
): EmbedBuilder {
  const embed = baseEmbed(BRAND_COLOR).setTitle("🏆 Leaderboard");

  if (entries.length === 0) {
    embed.setDescription("No data yet.");
    return embed;
  }

  const lines = entries.map((e) => {
    const medal =
      e.rank === 1 ? "🥇" : e.rank === 2 ? "🥈" : e.rank === 3 ? "🥉" : `#${e.rank}`;
    return `${medal} **${e.username}** — ${e.azcPoints} AzC · Level ${e.level}`;
  });

  embed.setDescription(lines.join("\n"));
  embed.setFooter({ text: `${FOOTER_TEXT} · Page ${page}/${totalPages}` });

  return embed;
}

export function dailyQuestionEmbed(question: string, date: Date): EmbedBuilder {
  return baseEmbed(BRAND_COLOR)
    .setTitle("📅 Daily Question")
    .setDescription(question)
    .addFields({
      name: "Your Answer",
      value: "Reply below. Every answer earns XP and AzC Points.",
      inline: false,
    })
    .setFooter({
      text: `${FOOTER_TEXT} · ${date.toLocaleDateString("en-US")}`,
    });
}

export function coffeeRouletteEmbed(
  pairs: { user1: string; user2: string | null }[],
  week: string,
): EmbedBuilder {
  const embed = baseEmbed(BRAND_COLOR)
    .setTitle("☕ Coffee Roulette")
    .setDescription(`This week's (${week}) random pairs:`);

  if (pairs.length === 0) {
    embed.setDescription("No pairs could be created this week. See you next week!");
    return embed;
  }

  const lines = pairs.map((p, i) => {
    if (p.user2 === null) {
      return `${i + 1}. ${p.user1} ☕ *(wildcard — went solo)*`;
    }
    return `${i + 1}. ${p.user1} ↔️ ${p.user2}`;
  });

  embed.addFields({
    name: "Pairs",
    value: lines.join("\n"),
    inline: false,
  });

  return embed;
}

export function helpEmbed(): EmbedBuilder {
  return baseEmbed(BRAND_COLOR)
    .setTitle("Azedev OS — Help")
    .setDescription("Community management and gamification bot for Azedev.")
    .addFields(
      {
        name: "Slash Commands",
        value: [
          "`/profile [user]` — View your profile or someone else's",
          "`/leaderboard` — Top contributors leaderboard",
          "`/daily [action]` — Daily question (view / trigger)",
          "`/ayar` — Channel and role settings (admin)",
          "`/help` — This help menu",
        ].join("\n"),
        inline: false,
      },
      {
        name: "Prefix Commands",
        value: "`!thanks @user` — Award 10 AzC Points to someone",
        inline: false,
      },
      {
        name: "Systems",
        value: [
          "• **AzC Points** — earned by helping and participating",
          "• **XP & Levels** — increase through activity",
          "• **Coffee Roulette** — weekly random pairings every Friday",
          "• **Daily Question** — AI-powered daily discussion topic",
        ].join("\n"),
        inline: false,
      },
    );
}
