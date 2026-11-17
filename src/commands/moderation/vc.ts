import {
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  VoiceBasedChannel,
  TextChannel,
} from "discord.js";
import { Command } from "../../structures/Command";
import { addPunishment } from "../../lib/store";
import { getAutoModConfig } from "../../lib/automodStore";
import { formatPunishmentLabel } from "../../lib/automodEngine";
import { addVcBan, removeVcBan, getGuildVcBans, isUserVcBanned } from "../../lib/vcBanStore";
import { getVc247Status, joinVc247, leaveVc247 } from "../../lib/vc247Manager";
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
        .setName("ban")
        .setDescription("Permanently ban a member from all Voice Channels in this server")
        .addUserOption((opt) =>
          opt.setName("member").setDescription("Member to ban from Voice Channels").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason for VC ban").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("unban")
        .setDescription("Unban a member from Voice Channels")
        .addUserOption((opt) =>
          opt.setName("member").setDescription("Member to unban from VC").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("banlist").setDescription("List all currently VC-banned members")
    )
    .addSubcommand((sub) =>
      sub
        .setName("lock")
        .setDescription("Lock a Voice Channel so regular members cannot join")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Voice Channel to lock (defaults to your current VC)")
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("unlock")
        .setDescription("Unlock a Voice Channel so members can join")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Voice Channel to unlock (defaults to your current VC)")
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("muteall")
        .setDescription("Server-mute all non-staff members in a Voice Channel")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Voice Channel (defaults to your current VC)")
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("unmuteall")
        .setDescription("Server-unmute all members in a Voice Channel")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Voice Channel (defaults to your current VC)")
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("moveall")
        .setDescription("Bulk move all members from one Voice Channel to another")
        .addChannelOption((opt) =>
          opt
            .setName("from_channel")
            .setDescription("Source Voice Channel")
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName("to_channel")
            .setDescription("Destination Voice Channel")
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("clear")
        .setDescription("Clear recent messages in this voice channel's text chat")
        .addIntegerOption((opt) =>
          opt
            .setName("amount")
            .setDescription("Number of messages to clear (1-100, default: 50)")
            .setMinValue(1)
            .setMaxValue(100)
            .setRequired(false)
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
      sub
        .setName("247")
        .setDescription("Manage 24/7 persistent Voice Channel presence")
        .addStringOption((opt) =>
          opt
            .setName("action")
            .setDescription("24/7 Action")
            .addChoices(
              { name: "🎙️ Join & Stay 24/7", value: "join" },
              { name: "🚪 Leave & Disable 24/7", value: "leave" },
              { name: "📊 Check 24/7 Status", value: "status" }
            )
            .setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Target Voice Channel (defaults to your current VC)")
            .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("Check active VC Gali Shield & Anti-Louding status")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const sub = interaction.options.getSubcommand();
    const isEphemeral =
      sub === "status" ||
      sub === "banlist" ||
      (sub === "247" && interaction.options.getString("action") === "status");
    await interaction.deferReply({ flags: isEphemeral ? MessageFlags.Ephemeral : undefined });

    if (sub === "247") {
      const action = interaction.options.getString("action", true);
      const guild = interaction.guild;
      const caller =
        guild.members.cache.get(interaction.user.id) ||
        (await guild.members.fetch(interaction.user.id).catch(() => null));

      if (action === "status") {
        const status = getVc247Status(guild);
        const isOnline = status.enabled && status.connectionStatus === "ready";
        const embed = new EmbedBuilder()
          .setColor(isOnline ? BRAND.colors.success : BRAND.colors.neutral)
          .setTitle(`🎙️ ${BRAND.name} 24/7 Voice Channel Presence`)
          .setDescription(
            `• **Mode:** ${status.enabled ? "🟢 **ENABLED (24/7 ACTIVE)**" : "🔴 **DISABLED**"}\n` +
              `• **Connection:** \`${status.connectionStatus.toUpperCase()}\`\n` +
              `• **Channel:** ${status.channelId ? `<#${status.channelId}> (\`${status.channelName}\`)` : "_None_"}\n` +
              `• **Uptime:** \`${status.uptimeText}\`\n` +
              `• **Auto-Reconnects:** \`${status.reconnects}\`\n` +
              `• **Persistence:** Automatically reconnects on bot boot or network disconnects.`
          )
          .setFooter({ text: `${BRAND.footer} • 24/7 Voice Presence` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (action === "join") {
        let targetChannel = interaction.options.getChannel("channel") as VoiceBasedChannel | null;
        if (!targetChannel && caller) {
          targetChannel = caller.voice.channel;
        }

        if (!targetChannel) {
          await interaction.editReply({
            content: "⚠️ You must either specify a voice channel or be connected to one yourself.",
          });
          return;
        }

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
            `**${BRAND.name}** is now connected to <#${targetChannel.id}> and will stay **24/7**!\n\n` +
              `• **Target Channel:** <#${targetChannel.id}>\n` +
              `• **Auto-Reconnect:** Active\n` +
              `• **Self-Deafen & Mute:** Active (Optimized performance)`
          )
          .setFooter({ text: `${BRAND.footer} • 24/7 Persistent Voice` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (action === "leave") {
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
    }

    if (sub === "status") {
      const config = getAutoModConfig(interaction.guild.id);
      const bans = getGuildVcBans(interaction.guild.id);
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle("🎙️ Vyntric VC Voice Shield & Anti-Abuse System")
        .setDescription(
          "Real-time voice channel anti-abuse, automated anti-gali chat protection, and staff voice controls."
        )
        .addFields(
          {
            name: "🛡️ VC Chat AutoMod Gali Shield",
            value: config.enabled ? "✅ Active (Instant VC Kick + 5m Timeout on slurs)" : "❌ Disabled",
            inline: true,
          },
          {
            name: "🔊 Anti-Louding & Mic Crackle",
            value: config.antiLouding ? "✅ Active (Disconnects + 10m Timeout on spam/crackling)" : "❌ Disabled",
            inline: true,
          },
          {
            name: "🚫 Active VC Bans",
            value: `${bans.length} member(s) banned from voice channels`,
            inline: true,
          },
          {
            name: "🔀 Anti-VC Hopping / Raid",
            value: "✅ Active (5+ fast channel hops = 5m timeout)",
            inline: true,
          },
          {
            name: "👻 Anti-Ghost Join/Leave Chime Spam",
            value: "✅ Active (Rapid connect/disconnect = 5m timeout)",
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

    if (sub === "banlist") {
      const bans = getGuildVcBans(interaction.guild.id);
      if (bans.length === 0) {
        await interaction.editReply({
          content: "✅ There are currently **no active VC bans** in this server.",
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.danger)
        .setTitle(`🚫 Active Voice Channel Bans (${bans.length})`)
        .setDescription(
          bans
            .slice(0, 25)
            .map(
              (b, i) =>
                `**${i + 1}.** <@${b.userId}> (\`${b.userTag}\`)\n` +
                `• Reason: \`${b.reason}\`\n` +
                `• Banned By: ${b.staffTag} • <t:${Math.floor(b.timestamp / 1000)}:R>`
            )
            .join("\n\n")
        )
        .setFooter({ text: "Use /vc unban <member> to revoke a VC ban" })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const staffMember = interaction.member as any;
    const canModVc =
      interaction.guild.ownerId === interaction.user.id ||
      staffMember?.permissions?.has(PermissionFlagsBits.ModerateMembers) ||
      staffMember?.permissions?.has(PermissionFlagsBits.ManageGuild) ||
      staffMember?.permissions?.has(PermissionFlagsBits.Administrator) ||
      staffMember?.roles?.cache?.has("1571258783471243304") ||
      staffMember?.roles?.cache?.some((r: any) => r.name.toLowerCase().includes("vc mod"));

    if (!canModVc) {
      await interaction.editReply({
        content: "❌ **Permission Denied:** You need the `🎙️ VC Mod Perms` role or Moderate Members permission to use this command.",
      });
      return;
    }

    // Channel-level operations
    if (sub === "lock" || sub === "unlock") {
      const channelOption = interaction.options.getChannel("channel");
      const callerVc = staffMember?.voice?.channel;
      const targetChannel = (channelOption || callerVc) as VoiceBasedChannel | null;

      if (!targetChannel) {
        await interaction.editReply({
          content: "❌ Please specify a voice channel or join one to perform this action.",
        });
        return;
      }

      const isLocking = sub === "lock";
      try {
        await (targetChannel as any).permissionOverwrites.edit(
          interaction.guild.roles.everyone.id,
          {
            Connect: isLocking ? false : null,
          },
          { reason: `VC ${isLocking ? "Locked" : "Unlocked"} by ${interaction.user.tag}` }
        );

        const embed = new EmbedBuilder()
          .setColor(isLocking ? BRAND.colors.danger : BRAND.colors.success)
          .setTitle(isLocking ? "🔒 Voice Channel Locked" : "🔓 Voice Channel Unlocked")
          .setDescription(
            isLocking
              ? `**#${targetChannel.name}** is now **locked**. Non-staff members cannot connect.`
              : `**#${targetChannel.name}** is now **unlocked**. Members can connect normally.`
          )
          .addFields({
            name: "Moderator",
            value: `${interaction.user} (\`${interaction.user.tag}\`)`,
            inline: true,
          })
          .setFooter({ text: BRAND.footer })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (err: any) {
        await interaction.editReply({
          content: `❌ Failed to ${sub} voice channel: ${err.message || "Missing permissions"}`,
        });
      }
      return;
    }

    if (sub === "muteall" || sub === "unmuteall") {
      const channelOption = interaction.options.getChannel("channel");
      const callerVc = staffMember?.voice?.channel;
      const targetChannel = (channelOption || callerVc) as VoiceBasedChannel | null;

      if (!targetChannel) {
        await interaction.editReply({
          content: "❌ Please specify a voice channel or join one to perform this action.",
        });
        return;
      }

      const isMuting = sub === "muteall";
      let affected = 0;
      for (const [_, member] of targetChannel.members) {
        if (member.id === interaction.user.id || member.user.bot) continue;
        if (
          isMuting &&
          (member.permissions.has(PermissionFlagsBits.ModerateMembers) ||
            member.permissions.has(PermissionFlagsBits.Administrator))
        ) {
          continue;
        }

        try {
          if (isMuting && !member.voice.serverMute) {
            await member.voice.setMute(true, `VC MuteAll by ${interaction.user.tag}`);
            affected++;
          } else if (!isMuting && member.voice.serverMute) {
            await member.voice.setMute(false, `VC UnmuteAll by ${interaction.user.tag}`);
            affected++;
          }
        } catch {}
      }

      const embed = new EmbedBuilder()
        .setColor(isMuting ? BRAND.colors.warning : BRAND.colors.success)
        .setTitle(isMuting ? "🔇 Voice Channel MuteAll Executed" : "🔊 Voice Channel UnmuteAll Executed")
        .setDescription(
          isMuting
            ? `Server-muted **${affected}** member(s) in **#${targetChannel.name}**.`
            : `Server-unmuted **${affected}** member(s) in **#${targetChannel.name}**.`
        )
        .addFields({
          name: "Moderator",
          value: `${interaction.user} (\`${interaction.user.tag}\`)`,
          inline: true,
        })
        .setFooter({ text: BRAND.footer })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === "moveall") {
      const fromChannel = interaction.options.getChannel("from_channel", true) as VoiceBasedChannel;
      const toChannel = interaction.options.getChannel("to_channel", true) as VoiceBasedChannel;

      if (fromChannel.id === toChannel.id) {
        await interaction.editReply({
          content: "❌ The source and destination voice channels cannot be the same.",
        });
        return;
      }

      let moved = 0;
      for (const [_, member] of fromChannel.members) {
        try {
          await member.voice.setChannel(toChannel, `VC MoveAll by ${interaction.user.tag}`);
          moved++;
        } catch {}
      }

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle("🔀 Voice Channel Bulk Move Completed")
        .setDescription(`Moved **${moved}** member(s) from **#${fromChannel.name}** to **#${toChannel.name}**.`)
        .addFields({
          name: "Moderator",
          value: `${interaction.user} (\`${interaction.user.tag}\`)`,
          inline: true,
        })
        .setFooter({ text: BRAND.footer })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === "clear") {
      const amount = interaction.options.getInteger("amount") || 50;
      const ch = interaction.channel;
      if (!ch || !ch.isTextBased()) {
        await interaction.editReply({ content: "❌ Cannot clear messages in this channel." });
        return;
      }

      try {
        const deleted = await (ch as any).bulkDelete(amount, true);
        await interaction.editReply({
          content: `🧹 Successfully cleared **${deleted.size}** messages from this channel.`,
        });
      } catch (err: any) {
        await interaction.editReply({
          content: `❌ Failed to clear messages: ${err.message || "Messages may be older than 14 days"}`,
        });
      }
      return;
    }

    // Member-specific operations
    const targetUser = interaction.options.getUser("member", true);
    const reason = interaction.options.getString("reason") || "No reason provided by staff";
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (sub === "unban") {
      const removed = removeVcBan(interaction.guild.id, targetUser.id);
      if (!removed) {
        await interaction.editReply({
          content: `⚠️ **${targetUser.tag}** is not in the active VC ban list.`,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.success)
        .setTitle("✅ Member Unbanned from Voice Channels")
        .setDescription(`**${targetUser.tag}** has been removed from the VC ban list and can now join voice channels again.`)
        .addFields({
          name: "Staff Moderator",
          value: `${interaction.user} (\`${interaction.user.tag}\`)`,
          inline: true,
        })
        .setFooter({ text: BRAND.footer })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === "ban") {
      // Role hierarchy check
      if (
        member &&
        interaction.guild.ownerId !== interaction.user.id &&
        member.roles.highest.position >= (interaction.member as any)?.roles?.highest?.position
      ) {
        await interaction.editReply({
          content: "❌ You cannot VC-ban this member because their role is equal to or higher than yours.",
        });
        return;
      }

      addVcBan({
        guildId: interaction.guild.id,
        userId: targetUser.id,
        userTag: targetUser.tag,
        staffId: interaction.user.id,
        staffTag: interaction.user.tag,
        reason,
        timestamp: Date.now(),
      });

      let kickedNote = "";
      if (member?.voice?.channel) {
        const currentVc = member.voice.channel.name;
        await member.voice.disconnect(`VC Ban: ${reason} (by ${interaction.user.tag})`).catch(() => {});
        kickedNote = ` (and disconnected from #${currentVc})`;
      }

      addPunishment({
        guildId: interaction.guild.id,
        userId: targetUser.id,
        username: targetUser.tag,
        kind: "kick",
        reason: `[VC Ban] ${reason}`,
        durationDays: null,
        staffId: interaction.user.id,
        staffTag: interaction.user.tag,
      });

      // DM Notice
      const dmEmbed = new EmbedBuilder()
        .setColor(BRAND.colors.danger)
        .setTitle("🚫 Voice Channel Ban Issued")
        .setDescription(
          `You have been banned from joining Voice Channels in **${interaction.guild.name}**.\n` +
          `Whenever you attempt to connect, you will be automatically disconnected.`
        )
        .addFields(
          { name: "Reason", value: `\`${reason}\``, inline: true },
          { name: "Staff Moderator", value: `${interaction.user.tag}`, inline: true }
        )
        .setFooter({ text: `${BRAND.name} Voice Security` })
        .setTimestamp();

      await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.danger)
        .setTitle("🚫 Member Banned from Voice Channels")
        .setDescription(`**${targetUser.tag}** has been banned from joining all voice channels in this server${kickedNote}.`)
        .addFields(
          { name: "Staff Moderator", value: `${interaction.user} (\`${interaction.user.tag}\`)`, inline: true },
          { name: "Reason", value: `\`${reason}\``, inline: true }
        )
        .setFooter({ text: `${BRAND.name} Voice Security • Use /vc unban to revoke` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

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
            .setTitle("🔇 Member Server-Muted in Voice")
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
            content: `❌ Failed to mute member: ${err.message || "Missing Mute Members permission"}`,
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
            .setTitle("🔊 Member Server-Unmuted in Voice")
            .setDescription(`**${member.user.tag}** has been unmuted in **#${member.voice.channel.name}**.`)
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
            content: `❌ Failed to unmute member: ${err.message || "Missing Mute Members permission"}`,
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
            .setTitle("🔇 Member Server-Deafened in Voice")
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
            content: `❌ Failed to deafen member: ${err.message || "Missing Deafen Members permission"}`,
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
            .setTitle("🔊 Member Server-Undeafened in Voice")
            .setDescription(`**${member.user.tag}** has been undeafened in **#${member.voice.channel.name}**.`)
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
            content: `❌ Failed to undeafen member: ${err.message || "Missing Deafen Members permission"}`,
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
        if (member.voice.channelId === targetChannel.id) {
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
            durationDays: Math.round((durationMs / (24 * 60 * 60 * 1000)) * 10) / 10,
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
