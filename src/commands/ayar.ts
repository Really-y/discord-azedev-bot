import {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
} from "discord.js";
import type {
  ChatInputCommandInteraction,
  Guild,
  GuildMember,
} from "discord.js";
import type { SlashCommand } from "../types";
import {
  getAllSettings,
  setSetting,
  getAdminUserIds,
  addAdminUserId,
  removeAdminUserId,
  SETTING_KEYS,
} from "../services/settings";
import {
  successEmbed,
  errorEmbed,
  warningEmbed,
  infoEmbed,
  brandEmbed,
} from "../utils/embedBuilder";
import { handleError } from "../utils/errorHandler";
import { USER_FACING_ERRORS } from "../utils/constants";
import { logger } from "../utils/logger";

const CHANNEL_OPTIONS = [
  { value: "daily", label: "Daily Question", key: SETTING_KEYS.dailyQuestionChannelId },
  { value: "coffee", label: "Coffee Roulette", key: SETTING_KEYS.coffeeRouletteChannelId },
  { value: "leaderboard", label: "Leaderboard", key: SETTING_KEYS.leaderboardChannelId },
] as const;

const ROLE_OPTIONS = [
  { value: "activ", label: "Active Member", key: SETTING_KEYS.activMemberRoleId },
  { value: "veteran", label: "Veteran", key: SETTING_KEYS.veteranRoleId },
  { value: "elit", label: "Elite", key: SETTING_KEYS.elitRoleId },
  { value: "ping_role", label: "Daily Ping", key: SETTING_KEYS.pingRoleId },
] as const;

async function isAdmin(userId: string): Promise<boolean> {
  const ids = await getAdminUserIds();
  return ids.includes(userId);
}

export const ayarCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("ayar")
    .setDescription("Bot settings — manage channel and role IDs (admin)")
    .addSubcommand((sub) =>
      sub.setName("view").setDescription("Show current settings"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("channel")
        .setDescription("Set a channel ID")
        .addStringOption((opt) =>
          opt
            .setName("type")
            .setDescription("Which channel?")
            .setRequired(true)
            .addChoices(
              { name: "Daily Question", value: "daily" },
              { name: "Coffee Roulette", value: "coffee" },
              { name: "Leaderboard", value: "leaderboard" },
            ),
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Select a channel")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("role")
        .setDescription("Set a role ID")
        .addStringOption((opt) =>
          opt
            .setName("type")
            .setDescription("Which role?")
            .setRequired(true)
            .addChoices(
              { name: "Active Member", value: "activ" },
              { name: "Veteran", value: "veteran" },
              { name: "Elite", value: "elit" },
              { name: "Daily Ping", value: "ping_role" },
            ),
        )
        .addRoleOption((opt) =>
          opt.setName("role").setDescription("Select a role").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Auto-create channels and roles (initial setup)"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("admin")
        .setDescription("Manage admins (owner)")
        .addStringOption((opt) =>
          opt
            .setName("action")
            .setDescription("Action")
            .setRequired(true)
            .addChoices(
              { name: "List", value: "list" },
              { name: "Add", value: "add" },
              { name: "Remove", value: "remove" },
            ),
        )
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("User (for add/remove)")
            .setRequired(false),
        ),
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

      if (!(await isAdmin(interaction.user.id))) {
        const member = interaction.member as GuildMember | null;
        const hasAdminPerms = member
          ? member.permissions.has(PermissionFlagsBits.Administrator)
          : false;
        if (!hasAdminPerms) {
          await interaction.reply({
            embeds: [errorEmbed("Insufficient Permissions", USER_FACING_ERRORS.noPermission)],
            ephemeral: true,
          });
          return;
        }
      }

      const sub = interaction.options.getSubcommand();

      switch (sub) {
        case "view":
          await handleView(interaction);
          break;
        case "channel":
          await handleSetChannel(interaction);
          break;
        case "role":
          await handleSetRole(interaction);
          break;
        case "setup":
          await handleAutoCreate(interaction);
          break;
        case "admin":
          await handleAdmin(interaction);
          break;
        default:
          await interaction.reply({
            embeds: [errorEmbed("Unknown Command", USER_FACING_ERRORS.generic)],
            ephemeral: true,
          });
      }
    } catch (error) {
      const msg = handleError("ayarCommand", error);
      const alreadyReplied = interaction.deferred || interaction.replied;
      await interaction[alreadyReplied ? "followUp" : "reply"]({
        embeds: [errorEmbed("Error", msg)],
        ephemeral: true,
      });
    }
  },
};

async function handleView(interaction: ChatInputCommandInteraction): Promise<void> {
  const settings = await getAllSettings();

  const fmt = (val: string): string =>
    val ? `<#${val}> \`(${val})\`` : "❌ Not set";
  const fmtRole = (val: string): string =>
    val ? `<@&${val}> \`(${val})\`` : "❌ Not set";

  const embed = brandEmbed("Bot Settings", "Current channel and role configuration:")
    .addFields(
      { name: "📢 Daily Question Channel", value: fmt(settings.DAILY_QUESTION_CHANNEL_ID), inline: false },
      { name: "☕ Coffee Roulette Channel", value: fmt(settings.COFFEE_ROULETTE_CHANNEL_ID), inline: false },
      { name: "🏆 Leaderboard Channel", value: fmt(settings.LEADERBOARD_CHANNEL_ID), inline: false },
      { name: "🟢 Active Member Role", value: fmtRole(settings.ACTIV_MEMBER_ROLE_ID), inline: true },
      { name: "🔵 Veteran Role", value: fmtRole(settings.VETERAN_ROLE_ID), inline: true },
      { name: "🟣 Elite Role", value: fmtRole(settings.ELIT_ROLE_ID), inline: true },
      { name: "📣 Daily Ping Role", value: fmtRole(settings.PING_ROLE_ID), inline: true },
    )
    .addFields({
      name: "Usage",
      value: [
        "`/ayar channel` — set a channel",
        "`/ayar role` — set a role",
        "`/ayar setup` — auto-create everything",
      ].join("\n"),
      inline: false,
    });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleSetChannel(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const tip = interaction.options.getString("type", true);
  const channel = interaction.options.getChannel("channel", true);

  const opt = CHANNEL_OPTIONS.find((c) => c.value === tip);
  if (!opt) {
    await interaction.reply({
      embeds: [errorEmbed("Invalid Type", "Unknown channel type.")],
      ephemeral: true,
    });
    return;
  }

  await setSetting(opt.key, channel.id);

  await interaction.reply({
    embeds: [
      successEmbed(
        "Channel Set",
        `**${opt.label}** channel set to ${channel}.`,
      ),
    ],
    ephemeral: true,
  });
}

async function handleSetRole(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const tip = interaction.options.getString("type", true);
  const role = interaction.options.getRole("role", true);

  const opt = ROLE_OPTIONS.find((r) => r.value === tip);
  if (!opt) {
    await interaction.reply({
      embeds: [errorEmbed("Invalid Type", "Unknown role type.")],
      ephemeral: true,
    });
    return;
  }

  await setSetting(opt.key, role.id);

  await interaction.reply({
    embeds: [
      successEmbed(
        "Role Set",
        `**${opt.label}** role set to ${role}.`,
      ),
    ],
    ephemeral: true,
  });
}

async function handleAutoCreate(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild as Guild;
  const me = guild.members.me;

  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    await interaction.editReply({
      embeds: [
        errorEmbed(
          "Insufficient Permissions",
          "The bot needs **Manage Channels** permission. Grant it from server settings.",
        ),
      ],
    });
    return;
  }

  const canManageRoles = me.permissions.has(PermissionFlagsBits.ManageRoles);

  const results: string[] = [];

  const channelsToCreate = [
      { name: "daily-question", topic: "AI-powered daily discussion questions", key: SETTING_KEYS.dailyQuestionChannelId, label: "Daily Question" },
      { name: "coffee-roulette", topic: "Weekly random coffee chat pairings", key: SETTING_KEYS.coffeeRouletteChannelId, label: "Coffee Roulette" },
      { name: "leaderboard", topic: "Top AzC Points earners", key: SETTING_KEYS.leaderboardChannelId, label: "Leaderboard" },
  ];

  for (const ch of channelsToCreate) {
    try {
      const channel = await guild.channels.create({
        name: ch.name,
        type: ChannelType.GuildText,
        topic: ch.topic,
      });
      await setSetting(ch.key, channel.id);
      results.push(`✅ **${ch.label}** channel created: ${channel}`);
      logger.info(`Auto-created channel: ${ch.name} (${channel.id})`);
    } catch (error) {
      results.push(`❌ **${ch.label}** channel could not be created: ${error instanceof Error ? error.message : String(error)}`);
      logger.error(`Failed to create channel ${ch.name}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (canManageRoles) {
    const rolesToCreate = [
      { name: "Active Member", color: 0x57f287, key: SETTING_KEYS.activMemberRoleId, label: "Active Member" },
      { name: "Veteran", color: 0x5865f2, key: SETTING_KEYS.veteranRoleId, label: "Veteran" },
      { name: "Elite", color: 0xeb459e, key: SETTING_KEYS.elitRoleId, label: "Elite" },
    ];

    for (const r of rolesToCreate) {
      try {
        const role = await guild.roles.create({
          name: r.name,
          color: r.color,
          mentionable: true,
          reason: "Azedev OS auto-setup",
        });
        await setSetting(r.key, role.id);
        results.push(`✅ **${r.label}** role created: ${role}`);
        logger.info(`Auto-created role: ${r.name} (${role.id})`);
      } catch (error) {
        results.push(`❌ **${r.label}** role could not be created: ${error instanceof Error ? error.message : String(error)}`);
        logger.error(`Failed to create role ${r.name}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } else {
    results.push("⚠️ Roles were not created — bot lacks **Manage Roles** permission.");
  }

  const embed = infoEmbed("Auto Setup Complete")
    .setDescription(results.join("\n"))
    .addFields({
      name: "Next Step",
      value: "Use `/ayar view` to verify the settings.",
      inline: false,
    });

  await interaction.editReply({ embeds: [embed] });
}

async function handleAdmin(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const action = interaction.options.getString("action", true);

  if (action === "list") {
    const ids = await getAdminUserIds();
    const lines = ids.length > 0
      ? ids.map((id) => `<@${id}> \`(${id})\``).join("\n")
      : "No admins have been assigned.";
    await interaction.reply({
      embeds: [brandEmbed("Admin List", lines)],
      ephemeral: true,
    });
    return;
  }

  const targetUser = interaction.options.getUser("user");
  if (!targetUser) {
    await interaction.reply({
      embeds: [errorEmbed("User Not Specified", "Please select a user.")],
      ephemeral: true,
    });
    return;
  }

  if (action === "add") {
    await addAdminUserId(targetUser.id);
    await interaction.reply({
      embeds: [
        successEmbed(
          "Admin Added",
          `${targetUser} is now an admin.`,
        ),
      ],
      ephemeral: true,
    });
  } else if (action === "remove") {
    const envIds = (process.env.ADMIN_USER_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (envIds.includes(targetUser.id)) {
      await interaction.reply({
        embeds: [
          warningEmbed(
            "Cannot Remove Admin",
            `${targetUser} is defined in the ".env" file. Edit ".env" to remove them.`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }
    await removeAdminUserId(targetUser.id);
    await interaction.reply({
      embeds: [
        successEmbed(
          "Admin Removed",
          `${targetUser} is no longer an admin.`,
        ),
      ],
      ephemeral: true,
    });
  }
}
