import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "../../structures/Command";
import { BRAND, vyntricEmbed } from "../../lib/brand";
import {
  formatDateName,
  getDateChannelConfig,
  syncDateChannel,
  updateDateChannelConfig,
} from "../../lib/dateChannelStore";

export default {
  data: new SlashCommandBuilder()
    .setName("datechannel")
    .setDescription("Manage the automated live date channel (placed above ticket-kiddowit)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Create or re-position the live date channel at the very top of the server")
    )
    .addSubcommand((sub) =>
      sub
        .setName("sync")
        .setDescription("Force an immediate sync and refresh of the date channel name and embed")
    )
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription("View the current status, timezone, and live date preview")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used inside a Discord server.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const config = getDateChannelConfig(interaction.guild.id);

    if (sub === "setup" || sub === "sync") {
      try {
        const { channel, updated } = await syncDateChannel(interaction.guild, true);

        const embed = vyntricEmbed("success")
          .setTitle("📅 Live Date Channel Ready")
          .setDescription(
            [
              `The live date channel has been successfully set up and synchronized!`,
              "",
              `**Channel:** <#${channel.id}> (\`${channel.name}\`)`,
              `**Position:** Top of server (above \`ticket-kiddowit\`)`,
              `**Timezone:** \`${config.timeZone}\` (GMT+6 Bangladesh)`,
              `**Auto-update:** Enabled (automatically refreshes every midnight)`,
              "",
              updated
                ? "✅ *Channel name and embed were updated to current date.*"
                : "ℹ️ *Channel was already up to date.*",
            ].join("\n")
          )
          .setFooter({ text: `${BRAND.name} • Automated Server Utilities` });

        await interaction.editReply({ embeds: [embed] });
      } catch (err: any) {
        await interaction.editReply({
          embeds: [
            vyntricEmbed("danger")
              .setTitle("❌ Date Channel Setup Failed")
              .setDescription(`Error: \`${err.message || err}\``),
          ],
        });
      }
      return;
    }

    if (sub === "status") {
      const now = new Date();
      const currentFormatted = formatDateName(now, config.timeZone);

      const embed = vyntricEmbed("neutral")
        .setTitle("📅 Date Channel Status")
        .setDescription(
          [
            `**Channel:** ${config.channelId ? `<#${config.channelId}>` : "_Not created yet (run `/datechannel setup`)_"}`,
            `**Current Preview:** \`${currentFormatted}\``,
            `**Timezone:** \`${config.timeZone}\``,
            `**Status:** ${config.enabled ? "🟢 Active & Updating" : "🔴 Disabled"}`,
            `**Last Updated Date:** \`${config.lastUpdatedDate ?? "Never"}\``,
            "",
            "> *Updates automatically at 00:00 (midnight) to reflect the real-world date, month, year, and day of the week.*",
          ].join("\n")
        );

      await interaction.editReply({ embeds: [embed] });
    }
  },
} as Command;
