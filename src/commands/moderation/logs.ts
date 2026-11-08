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
    .setDescription("Configure Carl-bot style moderation & audit logging")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Set the destination channel for audit logs")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("The log channel")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
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
              { name: "Member Updates", value: "memberUpdate" }
            )
        )
        .addBooleanOption((opt) =>
          opt.setName("enabled").setDescription("Enable or disable").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("View current logging configuration")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const config = getLoggingConfig(guildId);

    switch (sub) {
      case "setup": {
        const channel = interaction.options.getChannel("channel", true) as TextChannel;
        updateLoggingConfig(guildId, { logChannelId: channel.id });

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(BRAND.colors.success)
              .setTitle("✅ Audit Logging Configured")
              .setDescription(`Audit logs will now be sent to <#${channel.id}>.`),
          ],
        });
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
          .setTitle("📋 Audit Logging Status")
          .addFields(
            {
              name: "📢 Log Channel",
              value: config.logChannelId ? `<#${config.logChannelId}>` : "❌ Disabled",
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
            }
          )
          .setFooter({ text: "Use /logs setup to change channel" });

        await interaction.reply({ embeds: [embed] });
        break;
      }
    }
  },
};

export default command;
