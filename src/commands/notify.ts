import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
} from "discord.js";
import type {
  ChatInputCommandInteraction,
  GuildMember,
} from "discord.js";
import type { SlashCommand } from "../types";
import {
  getAdminUserIds,
} from "../services/settings";
import {
  successEmbed,
  errorEmbed,
  warningEmbed,
  brandEmbed,
} from "../utils/embedBuilder";
import { handleError } from "../utils/errorHandler";
import { USER_FACING_ERRORS } from "../utils/constants";

const DEFAULT_ANNOUNCEMENT = [
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  "",
  "📢 **Azedev OS — Bot Features / Bot Funksiyaları**",
  "",
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  "",
  "⭐ **AzC Points**",
  "  EN: Earn points by helping others and participating in discussions.",
  "  AZ: Kömək etdikcə və müzakirələrdə iştirak etdikcə xal qazanın.",
  "",
  "📈 **XP & Levels / Səviyyələr**",
  "  EN: Gain XP from messages and activities. Level up to unlock roles!",
  "  AZ: Mesaj və aktivliklə XP qazanın. Səviyyə atlayıb rollar açın!",
  "  • Level 5 → @Active Member",
  "  • Level 10 → @Veteran",
  "  • Level 20 → @Elite",
  "",
  "☕ **Coffee Roulette**",
  "  EN: Random pairings every Friday. Meet new people!",
  "  AZ: Hər cümə təsadüfi cütlüklər. Yeni insanlarla tanış olun!",
  "",
  "📅 **Daily Question / Günün Sualı**",
  "  EN: AI-powered discussion topic every day at 10:00.",
  "  AZ: Hər gün saat 10:00-da AI ilə müzakirə mövzusu.",
  "  🔔 Click the button to toggle daily ping notifications!",
  "",
  "💬 **Commands / Əmrlər**",
  "  `/profile` — View your stats / Statistikaya bax",
  "  `/leaderboard` — Top contributors / Liderlik tablosu",
  "  `/daily` — Daily question / Günün sualı",
  "  `!thanks @user` — Award 10 AzC Points / 10 xal ver",
  "",
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  "",
  "Welcome to the community! / İcmaya xoş gəldiniz! 🎉",
].join("\n");

export const notifyCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("notify")
    .setDescription("Send @everyone announcement (admin) / Duyuru göndər (admin)")
    .addStringOption((opt) =>
      opt
        .setName("message")
        .setDescription("Custom message (optional) / İstəyə bağlı mətn")
        .setRequired(false),
    )
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Target channel / Hədəf kanal (default: current)")
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText),
    ) as SlashCommandBuilder,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      if (!interaction.guild) {
        await interaction.reply({
          embeds: [warningEmbed("Server Only / Yalnız serverdə", "This command only works in a server.")],
          ephemeral: true,
        });
        return;
      }

      const member = interaction.member as GuildMember | null;
      const isAdminUser = (await getAdminUserIds()).includes(interaction.user.id);
      const hasAdminPerm = member
        ? member.permissions.has(PermissionFlagsBits.Administrator)
        : false;

      if (!isAdminUser && !hasAdminPerm) {
        await interaction.reply({
          embeds: [errorEmbed("Permission Denied / İcazə yoxdur", USER_FACING_ERRORS.noPermission)],
          ephemeral: true,
        });
        return;
      }

      const customMessage = interaction.options.getString("message");
      const message = customMessage ?? DEFAULT_ANNOUNCEMENT;

      const targetChannel =
        (interaction.options.getChannel("channel") as TextChannel | null) ??
        (interaction.channel as TextChannel | null);

      if (!targetChannel || !(targetChannel instanceof TextChannel)) {
        await interaction.reply({
          embeds: [errorEmbed("Channel Error / Kanal xətası", "Could not find the target channel.")],
          ephemeral: true,
        });
        return;
      }

      const embed = brandEmbed("📢 Azedev OS").addFields({
        name: "Sent by / Göndərən",
        value: `${interaction.user}`,
        inline: false,
      }).setTimestamp();

      await interaction.reply({
        embeds: [successEmbed("Sent / Göndərildi", `Announcement posted to ${targetChannel}.`)],
        ephemeral: true,
      });

      await targetChannel.send({
        content: `@everyone\n\n${message}`,
        embeds: [embed],
        allowedMentions: { parse: ["everyone"] },
      });
    } catch (error) {
      const msg = handleError("notifyCommand", error);
      const alreadyReplied = interaction.deferred || interaction.replied;
      await interaction[alreadyReplied ? "followUp" : "reply"]({
        embeds: [errorEmbed("Error / Xəta", msg)],
        ephemeral: true,
      });
    }
  },
};
