import {
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { Command } from "../../structures/Command";
import {
  getLoggingConfig,
  updateLoggingConfig,
} from "../../lib/loggingStore";
import { BRAND } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("logs")
    .setDescription("Configure Carl-bot style message & command logging")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Set channels for message edit/delete logs and command logs")
        .addChannelOption((opt) =>
          opt
            .setName("message-channel")
            .setDescription("Channel for message edit & delete logs (e.g. # messege)")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addChannelOption((opt) =>
          opt
            .setName("command-channel")
            .setDescription("Channel for bot command execution logs (e.g. # command-log)")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("toggle")
        .setDescription("Toggle specific log events")
        .addStringOption((opt) =>
          opt
            .setName("event")
            .setDescription("Log event type")
            .setRequired(true)
            .addChoices(
              { name: "Message Deletes", value: "messageDelete" },
              { name: "Message Edits", value: "messageUpdate" },
              { name: "Command Executions", value: "commandLog" },
              { name: "Member Updates", value: "memberUpdate" }
            )
        )
        .addBooleanOption((opt) =>
          opt.setName("enabled").setDescription("Enable or disable").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("View current Carl-bot logging configuration")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const config = getLoggingConfig(guildId);

    switch (sub) {
      case "setup": {
        const msgChannel = interaction.options.getChannel("message-channel") as TextChannel | null;
        const cmdChannel = interaction.options.getChannel("command-channel") as TextChannel | null;

        if (!msgChannel && !cmdChannel) {
          await interaction.reply({
            content: "⚠️ Please specify at least one channel to configure (`message-channel` or `command-channel`).",
          });
          return;
        }

        const updates: any = {};
        if (msgChannel) {
          updates.messageLogChannelId = msgChannel.id;
          updates.logChannelId = msgChannel.id;
        }
        if (cmdChannel) {
          updates.commandLogChannelId = cmdChannel.id;
        }

        const updated = updateLoggingConfig(guildId, updates);

        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.success)
          .setTitle("✅ Audit Logging Channels Configured")
          .setDescription("Your logging channels have been updated successfully.")
          .addFields(
            {
              name: "💬 Message Logs (Edits / Deletes)",
              value: updated.messageLogChannelId ? `<#${updated.messageLogChannelId}>` : "_None_",
              inline: true,
            },
            {
              name: "⚡ Command Logs",
              value: updated.commandLogChannelId ? `<#${updated.commandLogChannelId}>` : "_None_",
              inline: true,
            }
          )
          .setFooter({ text: `${BRAND.name} Logging System` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "toggle": {
        const event = interaction.options.getString("event", true) as keyof typeof config;
        const enabled = interaction.options.getBoolean("enabled", true);

        updateLoggingConfig(guildId, { [event]: enabled });

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(enabled ? BRAND.colors.success : BRAND.colors.warning)
              .setDescription(`✅ **${event}** logging is now **${enabled ? "ENABLED" : "DISABLED"}**.`),
          ],
        });
        break;
      }

      case "status": {
        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.primary)
          .setTitle("📋 Carl-bot Style Logging Status")
          .setDescription("Real-time logging of messages, edits, deletions, and commands.")
          .addFields(
            {
              name: "💬 Message Log Channel",
              value: config.messageLogChannelId ? `<#${config.messageLogChannelId}>` : "❌ Disabled",
              inline: true,
            },
            {
              name: "⚡ Command Log Channel",
              value: config.commandLogChannelId ? `<#${config.commandLogChannelId}>` : "❌ Disabled",
              inline: true,
            },
            {
              name: "🗑️ Deleted Messages",
              value: config.messageDelete ? "✅ Enabled" : "❌ Disabled",
              inline: true,
            },
            {
              name: "✏️ Edited Messages",
              value: config.messageUpdate ? "✅ Enabled" : "❌ Disabled",
              inline: true,
            },
            {
              name: "💻 Command Executions",
              value: config.commandLog ? "✅ Enabled" : "❌ Disabled",
              inline: true,
            }
          )
          .setFooter({ text: "Use /logs setup to change channels" })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }
    }
  },
};

export default command;
