import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { Command } from "../../structures/Command";
import { unlockdownServer } from "../../lib/antiraidManager";
import { BRAND } from "../../lib/brand";
import { hasFeaturePermission } from "../../lib/permissionRolesStore";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Unlock a specific channel or lift server-wide emergency lockdown")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((opt) =>
      opt
        .setName("scope")
        .setDescription("Unlock this channel or entire server")
        .addChoices(
          { name: "💬 Current Channel", value: "channel" },
          { name: "🌐 Entire Server (All Channels)", value: "server" }
        )
        .setRequired(true)
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
        content: "❌ You need **Manage Channels**, **Manage Server**, or **🔐 Security Perms** to lift a lockdown.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const scope = interaction.options.getString("scope", true);

    if (scope === "server") {
      await interaction.deferReply();
      const res = await unlockdownServer(interaction.guild, interaction.user.tag);

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.success)
        .setTitle("🔓 Server Lockdown Lifted")
        .setDescription(
          `**${interaction.user.tag}** lifted the server-wide lockdown.\n\n` +
            `• **Channels Restored:** **${res.channelsRestored} channels**\n` +
            `• Normal messaging permissions have been restored.`
        )
        .setFooter({ text: `${BRAND.footer} • System Operational` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Single Channel Unlock
    const ch = interaction.channel;
    if (!ch || !ch.isTextBased() || ch.isDMBased()) {
      await interaction.reply({
        content: "❌ Unlock can only be applied to server text channels.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const textCh = ch as TextChannel;
    try {
      await textCh.permissionOverwrites.edit(
        interaction.guild.roles.everyone,
        {
          SendMessages: null,
          AddReactions: null,
          CreatePublicThreads: null,
        },
        { reason: `[Channel Unlock] Lifted by ${interaction.user.tag}` }
      );

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.success)
        .setTitle("🔓 Channel Unlocked")
        .setDescription(
          `This channel has been unlocked by <@${interaction.user.id}>.\n\n` +
            `• Members can now send messages and interact freely.`
        )
        .setFooter({ text: `${BRAND.footer} • Channel Restored` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err: any) {
      await interaction.reply({
        content: `❌ Could not unlock channel: ${err.message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
