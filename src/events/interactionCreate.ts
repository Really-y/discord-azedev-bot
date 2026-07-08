import { Events } from "discord.js";
import type {
  Client,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  ButtonInteraction,
  Interaction,
  GuildMember,
} from "discord.js";
import { getSlashCommand } from "../commands";
import { errorEmbed, successEmbed } from "../utils/embedBuilder";
import { handleError } from "../utils/errorHandler";
import { logger } from "../utils/logger";
import { USER_FACING_ERRORS } from "../utils/constants";
import { getPingRoleId } from "../services/settings";

export const interactionCreateEvent = {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction): Promise<void> {
    try {
      if (interaction.isChatInputCommand()) {
        await handleSlashCommand(interaction, interaction.client as Client);
      } else if (interaction.isAutocomplete()) {
        await handleAutocomplete(interaction);
      } else if (interaction.isButton()) {
        await handleButton(interaction);
      }
    } catch (error) {
      const msg = handleError("interactionCreate", error);
      const alreadyReplied =
        interaction.isRepliable() && (interaction.deferred || interaction.replied);
      if (interaction.isRepliable()) {
        await interaction[alreadyReplied ? "followUp" : "reply"]({
          embeds: [errorEmbed("Error", msg)],
          ephemeral: true,
        }).catch(() => {
        });
      }
    }
  },
};

async function handleSlashCommand(
  interaction: ChatInputCommandInteraction,
  _client: Client,
): Promise<void> {
  const command = getSlashCommand(interaction.commandName);
  if (!command) {
    logger.warn(`Unknown slash command: ${interaction.commandName}`);
    await interaction.reply({
      embeds: [errorEmbed("Unknown Command", USER_FACING_ERRORS.generic)],
      ephemeral: true,
    });
    return;
  }

  await command.execute(interaction);
}

async function handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const command = getSlashCommand(interaction.commandName);
  if (command?.autocomplete) {
    await command.autocomplete(interaction);
  }
}

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  if (interaction.customId === "daily_ping_toggle") {
    await handlePingToggle(interaction);
    return;
  }
  logger.debug(`Button clicked: ${interaction.customId}`, {
    user: interaction.user.id,
  });
}

async function handlePingToggle(
  interaction: ButtonInteraction,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      embeds: [errorEmbed("Server Only", "This only works in a server.")],
      ephemeral: true,
    });
    return;
  }

  const pingRoleId = await getPingRoleId();
  if (!pingRoleId) {
    await interaction.reply({
      embeds: [
        errorEmbed(
          "No Ping Role",
          "No ping role has been configured. Ask an admin to set one with `/ayar role`.",
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  const member = interaction.member as GuildMember;
  const hasRole = member.roles.cache.has(pingRoleId);

  try {
    if (hasRole) {
      await member.roles.remove(pingRoleId);
      await interaction.reply({
        embeds: [
          successEmbed(
            "Ping Notifications Off",
            "You will no longer be pinged for daily questions.",
          ),
        ],
        ephemeral: true,
      });
    } else {
      await member.roles.add(pingRoleId);
      await interaction.reply({
        embeds: [
          successEmbed(
            "Ping Notifications On",
            "You will now be pinged for daily questions.",
          ),
        ],
        ephemeral: true,
      });
    }
  } catch (error) {
    const msg = handleError("pingToggle", error);
    await interaction.reply({
      embeds: [errorEmbed("Error", msg)],
      ephemeral: true,
    });
  }
}
