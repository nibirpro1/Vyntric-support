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
import { addPunishment } from "../../lib/store";
import { getAutoModConfig } from "../../lib/automodStore";
import { formatPunishmentLabel } from "../../lib/automodEngine";
import { BRAND } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("vc")
    .setDescription("Advanced Voice Channel (VC) moderation & anti-abuse controls")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((sub) =>
      sub
        .setName("kick")
        .setDescription("Disconnect a member from their current Voice Channel")
        .addUserOption((opt) =>
          opt.setName("member").setDescription("Member to disconnect from VC").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason for VC kick").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("mute")
        .setDescription("Server-mute a member in Voice Channel")
        .addUserOption((opt) =>
          opt.setName("member").setDescription("Member to server-mute in VC").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason for mute").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("unmute")
        .setDescription("Server-unmute a member in Voice Channel")
        .addUserOption((opt) =>
          opt.setName("member").setDescription("Member to unmute in VC").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("deafen")
        .setDescription("Server-deafen a member in Voice Channel")
        .addUserOption((opt) =>
          opt.setName("member").setDescription("Member to server-deafen").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason for deafen").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("undeafen")
        .setDescription("Server-undeafen a member in Voice Channel")
        .addUserOption((opt) =>
          opt.setName("member").setDescription("Member to undeafen").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("move")
        .setDescription("Move a member to another Voice Channel")
        .addUserOption((opt) =>
          opt.setName("member").setDescription("Member to move").setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Target Voice Channel")
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("timeout")
        .setDescription("Timeout a member and immediately kick them from Voice Channel")
        .addUserOption((opt) =>
          opt.setName("member").setDescription("Member to punish").setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("duration")
            .setDescription("Timeout duration")
            .setRequired(true)
            .addChoices(
              { name: "1 Minute", value: "1m" },
              { name: "5 Minutes (Standard Gali Penalty)", value: "5m" },
              { name: "10 Minutes (Anti-Louding / Ear-Rape)", value: "10m" },
              { name: "30 Minutes", value: "30m" },
              { name: "1 Hour", value: "1h" },
              { name: "1 Day (24 Hours)", value: "1d" }
            )
        )
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason for timeout & VC kick").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("Check active VC Gali Shield & Anti-Louding status")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const sub = interaction.options.getSubcommand();
    const isEphemeral = sub === "status";
    await interaction.deferReply({ flags: isEphemeral ? MessageFlags.Ephemeral : undefined });

    if (sub === "status") {
      const config = getAutoModConfig(interaction.guild.id);
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle("🎙️ Vyntric Voice Channel (VC) Protection Status")
        .setDescription(
          "Vyntric actively moderates all voice channels across the server against abusive language (galagali), ear-rape/shouting, and mic spam."
        )
        .addFields(
          {
            name: "🛡️ VC Gali Shield",
            value: config.antiBadWords
              ? "✅ **Active across All VCs**\n*Catches Bangla, Banglish, Hindi & English profanity in VC chat with instant message deletion, 5m timeout & instant VC kick.*"
              : "❌ **Disabled**",
            inline: false,
          },
          {
            name: "🔊 Anti-Louding / Ear-Rape",
            value: config.antiLouding
              ? "✅ **Enabled (10m Timeout)**\n*Detects scream text, ear-rape slurs & rapid mic state spam.*"
              : "❌ **Disabled by default**\n*Enable anytime with `/automod louding enabled:true`.*",
            inline: false,
          },
          {
            name: "⚡ Base VC Penalty",
            value: `\`${formatPunishmentLabel(config.punishment)}\` + Immediate Voice Disconnect`,
            inline: true,
          },
          {
            name: "🛑 Auto-Escalation Ladder",
            value: config.escalatePunishment ? "✅ Enabled (Increases on repeat)" : "❌ Disabled",
            inline: true,
          },
          {
            name: "📋 Mod Log Channel",
            value: config.logChannelId ? `<#${config.logChannelId}>` : "❌ Not Set",
            inline: true,
          }
        )
        .setFooter({ text: `${BRAND.name} Voice Security • ${BRAND.footer}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const targetUser = interaction.options.getUser("member", true);
    const reason = interaction.options.getString("reason") || "No reason provided by staff";
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!member) {
      await interaction.editReply({
        content: "❌ That member is not currently in this server.",
      });
      return;
    }

    // Role hierarchy check
    if (
      interaction.guild.ownerId !== interaction.user.id &&
      member.roles.highest.position >= (interaction.member as any)?.roles?.highest?.position
    ) {
      await interaction.editReply({
        content: "❌ You cannot moderate this member because their role is equal to or higher than yours.",
      });
      return;
    }

    switch (sub) {
      case "kick": {
        if (!member.voice.channel) {
          await interaction.editReply({
            content: `❌ **${member.user.tag}** is not connected to any Voice Channel.`,
          });
          return;
        }

        const channelName = member.voice.channel.name;
        try {
          await member.voice.disconnect(`${reason} (by ${interaction.user.tag})`);
          addPunishment({
            guildId: interaction.guild.id,
            userId: member.id,
            username: member.user.tag,
            kind: "kick",
            reason: `[VC Kick from #${channelName}] ${reason}`,
            durationDays: null,
            staffId: interaction.user.id,
            staffTag: interaction.user.tag,
          });

          const embed = new EmbedBuilder()
            .setColor(BRAND.colors.warning)
            .setTitle("🎙️ Member Disconnected from Voice Channel")
            .setDescription(`**${member.user.tag}** has been kicked from **#${channelName}**.`)
            .addFields(
              { name: "Staff Moderator", value: `${interaction.user} (\`${interaction.user.tag}\`)`, inline: true },
              { name: "Reason", value: `\`${reason}\``, inline: true }
            )
            .setFooter({ text: BRAND.footer })
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });
        } catch (err: any) {
          await interaction.editReply({
            content: `❌ Failed to disconnect member: ${err.message || "Missing Voice permissions"}`,
          });
        }
        break;
      }

      case "mute": {
        if (!member.voice.channel) {
          await interaction.editReply({
            content: `❌ **${member.user.tag}** is not connected to any Voice Channel.`,
          });
          return;
        }

        try {
          await member.voice.setMute(true, `${reason} (by ${interaction.user.tag})`);
          const embed = new EmbedBuilder()
            .setColor(BRAND.colors.warning)
            .setTitle("🔇 Member Server-Muted in Voice Channel")
            .setDescription(`**${member.user.tag}** has been server-muted in **#${member.voice.channel.name}**.`)
            .addFields(
              { name: "Staff Moderator", value: `${interaction.user} (\`${interaction.user.tag}\`)`, inline: true },
              { name: "Reason", value: `\`${reason}\``, inline: true }
            )
            .setFooter({ text: BRAND.footer })
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });
        } catch (err: any) {
          await interaction.editReply({
            content: `❌ Failed to server-mute member: ${err.message || "Missing permissions"}`,
          });
        }
        break;
      }

      case "unmute": {
        if (!member.voice.channel) {
          await interaction.editReply({
            content: `❌ **${member.user.tag}** is not connected to any Voice Channel.`,
          });
          return;
        }

        try {
          await member.voice.setMute(false, `Unmuted by ${interaction.user.tag}`);
          const embed = new EmbedBuilder()
            .setColor(BRAND.colors.success)
            .setTitle("🔊 Member Server-Unmuted in Voice Channel")
            .setDescription(`**${member.user.tag}** is now unmuted in **#${member.voice.channel.name}**.`)
            .addFields({
              name: "Staff Moderator",
              value: `${interaction.user} (\`${interaction.user.tag}\`)`,
              inline: true,
            })
            .setFooter({ text: BRAND.footer })
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });
        } catch (err: any) {
          await interaction.editReply({
            content: `❌ Failed to server-unmute member: ${err.message || "Missing permissions"}`,
          });
        }
        break;
      }

      case "deafen": {
        if (!member.voice.channel) {
          await interaction.editReply({
            content: `❌ **${member.user.tag}** is not connected to any Voice Channel.`,
          });
          return;
        }

        try {
          await member.voice.setDeaf(true, `${reason} (by ${interaction.user.tag})`);
          const embed = new EmbedBuilder()
            .setColor(BRAND.colors.warning)
            .setTitle("🔇 Member Server-Deafened in Voice Channel")
            .setDescription(`**${member.user.tag}** has been server-deafened in **#${member.voice.channel.name}**.`)
            .addFields(
              { name: "Staff Moderator", value: `${interaction.user} (\`${interaction.user.tag}\`)`, inline: true },
              { name: "Reason", value: `\`${reason}\``, inline: true }
            )
            .setFooter({ text: BRAND.footer })
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });
        } catch (err: any) {
          await interaction.editReply({
            content: `❌ Failed to server-deafen member: ${err.message || "Missing permissions"}`,
          });
        }
        break;
      }

      case "undeafen": {
        if (!member.voice.channel) {
          await interaction.editReply({
            content: `❌ **${member.user.tag}** is not connected to any Voice Channel.`,
          });
          return;
        }

        try {
          await member.voice.setDeaf(false, `Undeafened by ${interaction.user.tag}`);
          const embed = new EmbedBuilder()
            .setColor(BRAND.colors.success)
            .setTitle("🎧 Member Server-Undeafened")
            .setDescription(`**${member.user.tag}** has been server-undeafened in **#${member.voice.channel.name}**.`)
            .addFields({
              name: "Staff Moderator",
              value: `${interaction.user} (\`${interaction.user.tag}\`)`,
              inline: true,
            })
            .setFooter({ text: BRAND.footer })
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });
        } catch (err: any) {
          await interaction.editReply({
            content: `❌ Failed to undeafen member: ${err.message || "Missing permissions"}`,
          });
        }
        break;
      }

      case "move": {
        if (!member.voice.channel) {
          await interaction.editReply({
            content: `❌ **${member.user.tag}** is not connected to any Voice Channel.`,
          });
          return;
        }

        const targetChannel = interaction.options.getChannel("channel", true) as VoiceBasedChannel;
        if (member.voice.channel.id === targetChannel.id) {
          await interaction.editReply({
            content: `⚠️ **${member.user.tag}** is already inside **#${targetChannel.name}**.`,
          });
          return;
        }

        try {
          await member.voice.setChannel(targetChannel, `Moved by ${interaction.user.tag}`);
          const embed = new EmbedBuilder()
            .setColor(BRAND.colors.primary)
            .setTitle("🔀 Member Moved between Voice Channels")
            .setDescription(`**${member.user.tag}** was moved to **#${targetChannel.name}**.`)
            .addFields({
              name: "Staff Moderator",
              value: `${interaction.user} (\`${interaction.user.tag}\`)`,
              inline: true,
            })
            .setFooter({ text: BRAND.footer })
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });
        } catch (err: any) {
          await interaction.editReply({
            content: `❌ Failed to move member: ${err.message || "Missing Move Members permission"}`,
          });
        }
        break;
      }

      case "timeout": {
        const durationChoice = interaction.options.getString("duration", true);
        const durationMsMap: Record<string, number> = {
          "1m": 60 * 1000,
          "5m": 5 * 60 * 1000,
          "10m": 10 * 60 * 1000,
          "30m": 30 * 60 * 1000,
          "1h": 60 * 60 * 1000,
          "1d": 24 * 60 * 60 * 1000,
        };
        const durationMs = durationMsMap[durationChoice] || 5 * 60 * 1000;

        if (!member.moderatable) {
          await interaction.editReply({
            content: "❌ I cannot timeout this member (higher role or administrator privileges).",
          });
          return;
        }

        try {
          // If in VC, disconnect immediately
          let kickedNote = "";
          if (member.voice.channel) {
            const oldVc = member.voice.channel.name;
            await member.voice.disconnect(`VC Timeout: ${reason} (by ${interaction.user.tag})`).catch(() => {});
            kickedNote = ` (and disconnected from #${oldVc})`;
          }

          await member.timeout(durationMs, `VC Penalty: ${reason} (by ${interaction.user.tag})`);

          addPunishment({
            guildId: interaction.guild.id,
            userId: member.id,
            username: member.user.tag,
            kind: "timeout",
            reason: `[VC Infraction] ${reason}`,
            durationDays: Math.round(durationMs / (24 * 60 * 60 * 1000) * 10) / 10,
            staffId: interaction.user.id,
            staffTag: interaction.user.tag,
          });

          const embed = new EmbedBuilder()
            .setColor(BRAND.colors.danger)
            .setTitle("🔨 Member Timed Out & Kicked from Voice Channel")
            .setDescription(`**${member.user.tag}** has been timed out for **${durationChoice}**${kickedNote}.`)
            .addFields(
              { name: "Staff Moderator", value: `${interaction.user} (\`${interaction.user.tag}\`)`, inline: true },
              { name: "Duration", value: `\`${durationChoice}\``, inline: true },
              { name: "Reason", value: `\`${reason}\``, inline: false }
            )
            .setFooter({ text: BRAND.footer })
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });
        } catch (err: any) {
          await interaction.editReply({
            content: `❌ Failed to timeout member: ${err.message || "Missing permissions"}`,
          });
        }
        break;
      }
    }
  },
};

export default command;
