import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { Command } from "../../structures/Command";
import { getAutoModConfig } from "../../lib/automodStore";
import { getLoggingConfig } from "../../lib/loggingStore";
import { BRAND } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("vcreport")
    .setDescription("Report abusive language (galagali), screaming, or ear-rape in a Voice Channel")
    .addUserOption((opt) =>
      opt.setName("member").setDescription("Member who was abusive in VC").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("Details of what was said/done in VC").setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const targetUser = interaction.options.getUser("member", true);
    const reason = interaction.options.getString("reason", true);

    if (targetUser.id === interaction.user.id) {
      await interaction.reply({
        content: "❌ You cannot report yourself.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (targetUser.bot) {
      await interaction.reply({
        content: "❌ Bots cannot be reported through VC report.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      await interaction.reply({
        content: "❌ That member is not currently in this server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const reporterMember = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    const currentVc = member.voice.channel || reporterMember?.voice.channel;

    // Find mod log channel
    const autoMod = getAutoModConfig(interaction.guild.id);
    const logsCfg = getLoggingConfig(interaction.guild.id);
    const logChannelId = autoMod.logChannelId || logsCfg.logChannelId || logsCfg.commandLogChannelId;

    let targetModChannel: TextChannel | null = null;
    if (logChannelId) {
      const ch = interaction.guild.channels.cache.get(logChannelId);
      if (ch && ch.isTextBased()) targetModChannel = ch as TextChannel;
    }

    if (!targetModChannel) {
      const fallback = interaction.guild.channels.cache.find(
        (c) =>
          c.isTextBased() &&
          (c.name.includes("mod") || c.name.includes("staff") || c.name.includes("log") || c.name.includes("admin"))
      );
      if (fallback && fallback.isTextBased()) targetModChannel = fallback as TextChannel;
    }

    if (!targetModChannel) {
      await interaction.reply({
        content: "⚠️ No moderator channel is currently configured to receive reports. Please notify staff directly.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const reportEmbed = new EmbedBuilder()
      .setColor(BRAND.colors.danger)
      .setTitle("🚨 Urgent: Voice Channel Abuse Report")
      .setDescription(
        `A voice channel infraction has been reported by ${interaction.user} (\`${interaction.user.tag}\`). Staff can take instant action using the buttons below.`
      )
      .addFields(
        {
          name: "Reported Member",
          value: `${member.user} (\`${member.user.tag}\` • ID: \`${member.id}\`)`,
          inline: true,
        },
        {
          name: "Reported By",
          value: `${interaction.user} (\`${interaction.user.tag}\`)`,
          inline: true,
        },
        {
          name: "Voice Channel",
          value: currentVc ? `<#${currentVc.id}> (\`${currentVc.name}\`)` : "Not currently connected",
          inline: true,
        },
        {
          name: "Reported Details",
          value: `\`\`\`${reason}\`\`\``,
          inline: false,
        }
      )
      .setFooter({ text: `${BRAND.name} Voice Moderation • Quick Action Panel` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`vcrep:timeout:${member.id}`)
        .setLabel("Kick & 5m Timeout")
        .setEmoji("🔨")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`vcrep:kick:${member.id}`)
        .setLabel("Kick from VC")
        .setEmoji("🚪")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`vcrep:mute:${member.id}`)
        .setLabel("Server Mute")
        .setEmoji("🔇")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`vcrep:dismiss:${member.id}`)
        .setLabel("Dismiss")
        .setEmoji("❌")
        .setStyle(ButtonStyle.Secondary)
    );

    await targetModChannel.send({
      content: "🔔 **Staff Notice:** A new voice abuse report was filed by a member.",
      embeds: [reportEmbed],
      components: [row],
    });

    await interaction.reply({
      content: `✅ **Thank you, your report has been submitted to staff!**\nModerators have been alerted to review **${member.user.tag}** in ${currentVc ? `<#${currentVc.id}>` : "Voice"}.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
