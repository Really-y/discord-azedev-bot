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

export const notifyCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("notify")
    .setDescription("Send an @everyone announcement (admin) / Duyuru göndər (admin)")
    .addStringOption((opt) =>
      opt
        .setName("message")
        .setDescription("Announcement text / Duyuru mətni")
        .setRequired(true),
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
          embeds: [warningEmbed("Server Only", "This command only works in a server.")],
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
          embeds: [errorEmbed("Permission Denied", USER_FACING_ERRORS.noPermission)],
          ephemeral: true,
        });
        return;
      }

      const message = interaction.options.getString("message", true);
      const targetChannel =
        (interaction.options.getChannel("channel") as TextChannel | null) ??
        (interaction.channel as TextChannel | null);

      if (!targetChannel || !(targetChannel instanceof TextChannel)) {
        await interaction.reply({
          embeds: [errorEmbed("Channel Error", "Could not find the target channel.")],
          ephemeral: true,
        });
        return;
      }

      const embed = brandEmbed("📢 Announcement / Duyuru", message)
        .addFields({
          name: "Sent by / Göndərən",
          value: `${interaction.user}`,
          inline: false,
        })
        .setTimestamp();

      await interaction.reply({
        embeds: [successEmbed("Sent / Göndərildi", `Announcement posted to ${targetChannel}.`)],
        ephemeral: true,
      });

      await targetChannel.send({
        content: `@everyone`,
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
