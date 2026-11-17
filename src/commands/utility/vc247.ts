import {
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  VoiceBasedChannel,
} from "discord.js";
import { Command } from "../../structures/Command";
import {
  getVc247Status,
  joinVc247,
  leaveVc247,
} from "../../lib/vc247Manager";
import { BRAND } from "../../lib/brand";
import { hasFeaturePermission } from "../../lib/permissionRolesStore";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("247")
    .setDescription("Configure VyntricBD 24/7 persistent Voice Channel presence")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("join")
        .setDescription("Connect VyntricBD to a Voice Channel to stay 24/7")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Voice channel to stay in 24/7 (defaults to your current VC)")
            .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("leave").setDescription("Disconnect VyntricBD and deactivate 24/7 voice mode")
    )
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("Check live 24/7 voice connection status and uptime")
    )
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Lock the designated 24/7 Voice Channel")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Voice channel to lock 24/7")
            .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.member) return;

    const member =
      interaction.guild.members.cache.get(interaction.user.id) ||
      (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));

    if (
      !member ||
      (!member.permissions.has(PermissionFlagsBits.ManageGuild) &&
        !member.permissions.has(PermissionFlagsBits.ManageChannels) &&
        !hasFeaturePermission(member, "security") &&
        !hasFeaturePermission(member, "vcmod"))
    ) {
      await interaction.reply({
        content: "❌ You need **Manage Server**, **Manage Channels**, or **🎙️ VC Mod Perms** to manage 24/7 voice mode.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    // ─────────────────────────────────────────────────────────────
    // 1. STATUS
    // ─────────────────────────────────────────────────────────────
    if (sub === "status") {
      const status = getVc247Status(guild);
      const isOnline = status.enabled && status.connectionStatus === "ready";

      const embed = new EmbedBuilder()
        .setColor(isOnline ? BRAND.colors.success : BRAND.colors.neutral)
        .setTitle(`🎙️ ${BRAND.name} 24/7 Voice Channel Presence`)
        .setDescription(
          `• **Mode:** ${status.enabled ? "🟢 **ENABLED (24/7 ACTIVE)**" : "🔴 **DISABLED**"}\n` +
            `• **Connection:** \`${status.connectionStatus.toUpperCase()}\`\n` +
            `• **Designated Channel:** ${status.channelId ? `<#${status.channelId}> (\`${status.channelName}\`)` : "_None_"}\n` +
            `• **Active Uptime:** \`${status.uptimeText}\`\n` +
            `• **Auto-Reconnects Handled:** \`${status.reconnects}\`\n` +
            `• **Auto-Reconnect Engine:** ✅ Active (Auto-reconnects on disconnect or reboot)`
        )
        .setFooter({ text: `${BRAND.footer} • 24/7 Voice Guardian` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 2. JOIN / SET
    // ─────────────────────────────────────────────────────────────
    if (sub === "join" || sub === "set") {
      let targetChannel = interaction.options.getChannel("channel") as VoiceBasedChannel | null;

      // If channel not passed in /247 join, check caller's current voice channel
      if (!targetChannel && sub === "join") {
        targetChannel = member.voice.channel;
      }

      if (!targetChannel) {
        await interaction.reply({
          content: "⚠️ You must either specify a voice channel or be connected to one yourself.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferReply();

      const res = await joinVc247(guild, targetChannel.id, interaction.user.tag);
      if (!res.success) {
        await interaction.editReply({
          content: `❌ Could not connect to **#${res.channelName}**: ${res.error}`,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.success)
        .setTitle("🎙️ 24/7 Voice Presence Activated")
        .setDescription(
          `**${BRAND.name}** is now connected to <#${targetChannel.id}> and will remain there **24/7**!\n\n` +
            `• **Channel:** <#${targetChannel.id}>\n` +
            `• **Auto-Reconnect:** Enabled (re-joins instantly on bot restart or disconnect)\n` +
            `• **Anti-Disconnect Shield:** Enabled (automatically prevents kick/move exploits)`
        )
        .setFooter({ text: `${BRAND.footer} • 24/7 Persistent Voice` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 3. LEAVE
    // ─────────────────────────────────────────────────────────────
    if (sub === "leave") {
      await interaction.deferReply();
      const res = await leaveVc247(guild);

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.neutral)
        .setTitle("🚪 24/7 Voice Mode Deactivated")
        .setDescription(
          `**${BRAND.name}** has disconnected${res.channelName ? ` from **#${res.channelName}**` : ""}.\n` +
            `24/7 persistent voice presence is now disabled.`
        )
        .setFooter({ text: BRAND.footer })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }
  },
};

export default command;
