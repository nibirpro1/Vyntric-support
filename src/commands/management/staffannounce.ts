import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "../../structures/Command";
import { VyntricClient } from "../../structures/VyntricClient";
import { canManageStaff } from "../../lib/permissions";
import { vyntricEmbed, section } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("staffannounce")
    .setDescription("Broadcast an official announcement to the Vyntric staff team")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) =>
      opt
        .setName("title")
        .setDescription("Announcement subject/headline")
        .setRequired(true)
        .setMaxLength(100)
    )
    .addStringOption((opt) =>
      opt
        .setName("message")
        .setDescription("Main announcement body (markdown supported)")
        .setRequired(true)
        .setMaxLength(1500)
    )
    .addBooleanOption((opt) =>
      opt
        .setName("urgent")
        .setDescription("Is this an urgent announcement? (Pings @here)")
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction, _client: VyntricClient) {
    if (!interaction.guild || !interaction.member) return;
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member || !canManageStaff(member)) {
      await interaction.reply({
        content: "🛡️ Only Lead Staff / Administrators can broadcast staff announcements.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const title = interaction.options.getString("title", true);
    const message = interaction.options.getString("message", true);
    const urgent = interaction.options.getBoolean("urgent") || false;

    const tone = urgent ? "danger" : "primary";
    const embed = vyntricEmbed(tone)
      .setTitle(`📢 Vyntric Staff Bulletin: ${title}`)
      .setDescription(
        `${section(urgent ? "🚨 URGENT STAFF NOTICE" : "Official Notice")}\n` +
          `${message}\n\n` +
          `• **Announced By:** <@${interaction.user.id}>\n` +
          `• **Date:** <t:${Math.floor(Date.now() / 1000)}:F>`
      );

    await interaction.reply({
      content: urgent ? "📢 **Attention Team:** @here" : undefined,
      embeds: [embed],
    });
  },
};

export default command;
