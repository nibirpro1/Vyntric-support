import {
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { Command } from "../../structures/Command";
import { lockdownServer, unlockdownServer } from "../../lib/antiraidManager";
import { BRAND } from "../../lib/brand";
import { hasFeaturePermission } from "../../lib/permissionRolesStore";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("lockdown")
    .setDescription("Lock down a specific channel or the entire server during emergencies")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((opt) =>
      opt
        .setName("scope")
        .setDescription("Lock this channel or entire server")
        .addChoices(
          { name: "💬 Current Channel", value: "channel" },
          { name: "🌐 Entire Server (All Public Channels)", value: "server" }
        )
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("Reason for lockdown").setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("duration")
        .setDescription("Lockdown duration in minutes (default: 15)")
        .setMinValue(1)
        .setMaxValue(1440)
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.member) return;

    const member =
      interaction.guild.members.cache.get(interaction.user.id) ||
      (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));

    if (
      !member ||
      (!member.permissions.has(PermissionFlagsBits.ManageChannels) &&
        !member.permissions.has(PermissionFlagsBits.ManageGuild) &&
        !hasFeaturePermission(member, "security") &&
        !hasFeaturePermission(member, "mod"))
    ) {
      await interaction.reply({
        content: "❌ You need **Manage Channels**, **Manage Server**, or **🔐 Security Perms** to execute a lockdown.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const scope = interaction.options.getString("scope", true);
    const reason = interaction.options.getString("reason") || "Staff Emergency Lockdown";
    const duration = interaction.options.getInteger("duration") || 15;

    if (scope === "server") {
      await interaction.deferReply();
      const res = await lockdownServer(
        interaction.guild,
        reason,
        interaction.user.tag,
        duration,
        "hard"
      );

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.danger)
        .setTitle("🔒 Server Emergency Lockdown Activated [HARD]")
        .setDescription(
          `**${interaction.user.tag}** initiated a server-wide emergency lockdown.\n\n` +
            `• **Channels Locked:** **${res.channelsLocked.length} channels**\n` +
            `• **Duration:** **${duration} minutes**\n` +
            `• **Reason:** *${reason}*`
        )
        .setFooter({ text: `${BRAND.footer} • Anti-Raid Defense` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Single Channel Lockdown
    const ch = interaction.channel;
    if (!ch || !ch.isTextBased() || ch.isDMBased()) {
      await interaction.reply({
        content: "❌ Lockdown can only be applied to server text channels.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const textCh = ch as TextChannel;
    try {
      await textCh.permissionOverwrites.edit(
        interaction.guild.roles.everyone,
        {
          SendMessages: false,
          AddReactions: false,
          CreatePublicThreads: false,
          CreatePrivateThreads: false,
          SendMessagesInThreads: false,
        },
        { reason: `[Channel Lockdown] ${reason} (by ${interaction.user.tag})` }
      );

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.danger)
        .setTitle("🔒 Channel Locked")
        .setDescription(
          `This channel has been temporarily locked by <@${interaction.user.id}>.\n\n` +
            `• **Reason:** *${reason}*\n` +
            `• **Duration:** ${duration} minutes\n` +
            `• Regular members cannot send messages until unlocked.`
        )
        .setFooter({ text: `${BRAND.footer} • Channel Lockdown` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err: any) {
      await interaction.reply({
        content: `❌ Could not lock channel: ${err.message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
