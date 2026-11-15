import {
  EmbedBuilder,
  GuildMember,
  Message,
  PermissionFlagsBits,
  TextChannel,
  User,
} from "discord.js";
import {
  addPunishment,
  clearUserWarnings,
  listPunishments,
  removePunishment,
} from "./store";
import { getAutoModConfig } from "./automodStore";
import { getLoggingConfig } from "./loggingStore";
import { BRAND } from "./brand";

/**
 * Checks if a member is authorized to run moderation commands.
 * Covers Server Owner, Administrators, Managers, and all Vyntric staff roles.
 */
export function canStaffModerate(member: GuildMember): boolean {
  if (member.id === member.guild.ownerId) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  if (member.permissions.has(PermissionFlagsBits.ModerateMembers)) return true;
  if (member.permissions.has(PermissionFlagsBits.KickMembers)) return true;
  if (member.permissions.has(PermissionFlagsBits.BanMembers)) return true;

  return member.roles.cache.some((r) => {
    const name = r.name.toLowerCase();
    return (
      name.includes("admin") ||
      name.includes("mod") ||
      name.includes("vyntric core") ||
      name.includes("vyntric trial") ||
      name.includes("staff") ||
      name.includes("lead")
    );
  });
}

/**
 * Parses user-friendly duration strings like:
 * "10s", "5m", "2h", "1d", "1w"
 */
function parseDurationMs(input: string): number | null {
  const clean = input.trim().toLowerCase();
  const regex = /(?:(\d+)\s*w)?\s*(?:(\d+)\s*d)?\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?/;
  const match = clean.match(regex);
  if (!match || match[0] === "") return null;

  const weeks = parseInt(match[1] || "0", 10);
  const days = parseInt(match[2] || "0", 10);
  const hours = parseInt(match[3] || "0", 10);
  const minutes = parseInt(match[4] || "0", 10);
  const seconds = parseInt(match[5] || "0", 10);

  const totalMs =
    weeks * 7 * 24 * 60 * 60 * 1000 +
    days * 24 * 60 * 60 * 1000 +
    hours * 60 * 60 * 1000 +
    minutes * 60 * 1000 +
    seconds * 1000;

  return totalMs > 0 ? totalMs : null;
}

/**
 * Handles text-based prefixless / prefix moderation commands:
 * e.g. "warn @user reason", "!warn @user reason", or replying "warn reason"
 * Returns true if a moderation command was handled.
 */
export async function handleTextModeration(message: Message): Promise<boolean> {
  if (!message.guild || message.author.bot) return false;

  const raw = message.content.trim();
  if (raw.length < 3) return false;

  // Match optional prefix (!, ., ?, -, ;, $) + command name + rest of line
  const match = raw.match(/^([!?.+\-$&;]?)([a-zA-Z]+)(?:\s+([\s\S]*))?$/);
  if (!match) return false;

  const commandName = match[2].toLowerCase();
  const argsString = (match[3] || "").trim();

  const VALID_COMMANDS = new Set([
    "warn",
    "warns",
    "warnings",
    "clearwarns",
    "clearwarn",
    "unwarn",
    "remwarn",
    "delwarn",
    "mute",
    "timeout",
    "unmute",
    "untimeout",
    "kick",
    "ban",
  ]);

  if (!VALID_COMMANDS.has(commandName)) return false;

  // Caller permission check
  const caller =
    message.member ||
    (await message.guild.members.fetch(message.author.id).catch(() => null));
  if (!caller || !canStaffModerate(caller)) {
    return false; // Silently ignore non-staff members
  }

  // ─────────────────────────────────────────────────────────────
  // RESOLVE TARGET USER
  // 1. Mentioned user in message (excluding bots if possible)
  // 2. User ID in args
  // 3. Author of replied-to message
  // ─────────────────────────────────────────────────────────────
  let targetUser: User | null = null;
  let remainingArgs = argsString;

  // Check replied message first if present
  let repliedMessage: Message | null = null;
  if (message.reference && message.reference.messageId) {
    try {
      repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
      if (repliedMessage && !repliedMessage.author.bot) {
        targetUser = repliedMessage.author;
      }
    } catch {}
  }

  // Check user mention in message content
  const firstMention = message.mentions.users.first();
  if (firstMention && firstMention.id !== message.client.user?.id) {
    targetUser = firstMention;
    // Strip the mention token from remaining args
    remainingArgs = remainingArgs.replace(new RegExp(`<@!?${firstMention.id}>`, "g"), "").trim();
  } else if (!targetUser) {
    // Check if first argument is a snowflake User ID
    const idMatch = remainingArgs.match(/^(\d{17,20})/);
    if (idMatch) {
      const parsedId = idMatch[1];
      targetUser = await message.client.users.fetch(parsedId).catch(() => null);
      if (targetUser) {
        remainingArgs = remainingArgs.slice(idMatch[0].length).trim();
      }
    }
  }

  // Special case: remwarn / delwarn might take a Case ID directly (e.g. pun_...)
  if ((commandName === "remwarn" || commandName === "delwarn") && !targetUser) {
    const caseId = remainingArgs.split(/\s+/)[0];
    if (caseId && caseId.startsWith("pun_")) {
      const removed = removePunishment(caseId);
      if (removed) {
        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.success)
          .setTitle("✅ Warning Removed")
          .setDescription(`Case **\`${caseId}\`** has been successfully removed by ${message.author}.`)
          .setFooter({ text: BRAND.footer })
          .setTimestamp();
        await message.reply({ embeds: [embed] });
        return true;
      } else {
        await message.reply({ content: `❌ No warning record found with Case ID \`${caseId}\`.` });
        return true;
      }
    }
  }

  // If no target user could be determined, do not trigger (avoids accidental triggers during chat)
  if (!targetUser) {
    return false;
  }

  if (targetUser.id === message.client.user?.id) {
    await message.reply({ content: "❌ I cannot perform moderation actions on myself." });
    return true;
  }

  if (targetUser.bot && (commandName === "warn" || commandName === "warns" || commandName === "warnings")) {
    await message.reply({ content: "⚠️ Bots cannot receive formal warnings." });
    return true;
  }

  const guild = message.guild;
  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

  // Hierarchy check: Non-owners cannot moderate owner or equal/higher staff
  if (guild.ownerId !== message.author.id && targetMember) {
    if (targetMember.id === guild.ownerId) {
      await message.reply({ content: "❌ You cannot moderate the server owner." });
      return true;
    }

    if (targetMember.roles.highest.position >= caller.roles.highest.position) {
      await message.reply({
        content: "❌ You cannot moderate this member because their role is equal to or higher than yours.",
      });
      return true;
    }
  }

  const autoMod = getAutoModConfig(guild.id);
  const logsCfg = getLoggingConfig(guild.id);
  const logChannelId =
    autoMod.logChannelId ||
    logsCfg.logChannelId ||
    logsCfg.commandLogChannelId ||
    "1508536272048885853";
  const logChannel = logChannelId
    ? (guild.channels.cache.get(logChannelId) as TextChannel | undefined)
    : undefined;

  // ─────────────────────────────────────────────────────────────
  // COMMAND EXECUTION
  // ─────────────────────────────────────────────────────────────

  // 1. WARN
  if (commandName === "warn") {
    const reason = remainingArgs.trim() || "No reason provided by staff";

    const record = addPunishment({
      guildId: guild.id,
      userId: targetUser.id,
      username: targetUser.tag,
      kind: "warn",
      reason,
      durationDays: null,
      staffId: message.author.id,
      staffTag: message.author.tag,
    });

    const allUserPunishments = listPunishments(guild.id, targetUser.id);
    const activeWarnings = allUserPunishments.filter((p) => p.kind === "warn" && !p.liftedAt);
    const strikeCount = activeWarnings.length;

    let escalationNote = "None (Strike logged)";
    let timeoutMs = 0;

    if (strikeCount === 2) {
      timeoutMs = 10 * 60 * 1000;
      escalationNote = "⚠️ **Strike 2 Penalty:** 10-Minute Timeout";
    } else if (strikeCount === 3) {
      timeoutMs = 60 * 60 * 1000;
      escalationNote = "🛑 **Strike 3 Penalty:** 1-Hour Timeout";
    } else if (strikeCount === 4) {
      timeoutMs = 12 * 60 * 60 * 1000;
      escalationNote = "🚨 **Strike 4 Penalty:** 12-Hour Timeout";
    } else if (strikeCount >= 5) {
      timeoutMs = 24 * 60 * 60 * 1000;
      escalationNote = "🔨 **Strike 5+ Severe Penalty:** 24-Hour Timeout";
    }

    if (timeoutMs > 0 && targetMember && targetMember.moderatable) {
      try {
        await targetMember.timeout(timeoutMs, `Auto-Escalation: Strike ${strikeCount} - ${reason}`);
      } catch (err: any) {
        console.warn("[textMod:timeout:error]", err.message);
      }
    }

    // Send DM to target user
    let dmSent = false;
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(BRAND.colors.warning)
        .setTitle(`⚠️ Warning Received in ${guild.name}`)
        .setDescription(
          `You have been issued a formal warning by staff.\n\n` +
            `• **Reason:** \`${reason}\`\n` +
            `• **Strike Level:** **Strike ${strikeCount}**\n` +
            `• **Action Taken:** ${escalationNote}\n` +
            `• **Case ID:** \`${record.id}\`\n\n` +
            `*Please follow our server rules to avoid further timeouts or a permanent ban.*`
        )
        .setFooter({ text: `${BRAND.name} Moderation` })
        .setTimestamp();

      await targetUser.send({ embeds: [dmEmbed] });
      dmSent = true;
    } catch {}

    const replyEmbed = new EmbedBuilder()
      .setColor(strikeCount >= 3 ? BRAND.colors.danger : BRAND.colors.warning)
      .setTitle(`⚠️ Formal Warning Issued (Strike ${strikeCount})`)
      .setDescription(`**${targetUser.tag}** has received a formal warning.`)
      .addFields(
        { name: "👤 Member", value: `${targetUser} (\`${targetUser.id}\`)`, inline: true },
        { name: "🛡️ Moderator", value: `${message.author} (\`${message.author.tag}\`)`, inline: true },
        { name: "🆔 Case ID", value: `\`${record.id}\``, inline: true },
        { name: "📝 Reason", value: `\`${reason}\``, inline: false },
        { name: "🛑 Strike Escalation", value: escalationNote, inline: true },
        { name: "📬 DM Notice", value: dmSent ? "✅ Delivered" : "❌ Closed / Blocked DMs", inline: true }
      )
      .setFooter({ text: `${BRAND.name} Moderation • Use /warn list to view history` })
      .setTimestamp();

    await message.reply({ embeds: [replyEmbed] });

    if (logChannel && logChannel.isTextBased()) {
      await logChannel.send({ embeds: [replyEmbed] }).catch(() => {});
    }
    return true;
  }

  // 2. WARNS / WARNINGS
  if (commandName === "warns" || commandName === "warnings") {
    const punishments = listPunishments(guild.id, targetUser.id);
    const warningsOnly = punishments.filter((p) => p.kind === "warn");

    if (warningsOnly.length === 0) {
      await message.reply({
        content: `✅ **${targetUser.tag}** has a clean record with **0 warnings**!`,
      });
      return true;
    }

    const activeCount = warningsOnly.filter((p) => !p.liftedAt).length;
    const lines = warningsOnly.slice(0, 15).map((p, i) => {
      const status = p.liftedAt ? "~~[PARDONED]~~" : "**[ACTIVE]**";
      return (
        `**${i + 1}.** ${status} \`${p.reason}\`\n` +
        `• Case: \`${p.id}\` • By: <@${p.staffId}> • Date: <t:${Math.floor(p.createdAt / 1000)}:R>`
      );
    });

    const embed = new EmbedBuilder()
      .setColor(activeCount > 0 ? BRAND.colors.warning : BRAND.colors.success)
      .setTitle(`📜 Warning History for ${targetUser.tag}`)
      .setDescription(lines.join("\n\n"))
      .addFields(
        { name: "Active Strikes", value: `**${activeCount}** active strike(s)`, inline: true },
        { name: "Total Warnings Logged", value: `**${warningsOnly.length}** recorded`, inline: true }
      )
      .setFooter({ text: `${BRAND.name} Moderation` })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
    return true;
  }

  // 3. CLEARWARNS / UNWARN
  if (commandName === "clearwarns" || commandName === "clearwarn" || commandName === "unwarn") {
    const removedCount = clearUserWarnings(guild.id, targetUser.id);
    if (removedCount === 0) {
      await message.reply({
        content: `ℹ️ **${targetUser.tag}** has 0 active warnings on record.`,
      });
      return true;
    }

    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.success)
      .setTitle("🧹 Member Warnings Cleared")
      .setDescription(
        `Successfully cleared **${removedCount}** warning(s) for ${targetUser} (\`${targetUser.tag}\`).`
      )
      .addFields({
        name: "Moderator",
        value: `${message.author} (\`${message.author.tag}\`)`,
        inline: true,
      })
      .setFooter({ text: `${BRAND.name} Moderation` })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
    return true;
  }

  // 4. MUTE / TIMEOUT
  if (commandName === "mute" || commandName === "timeout") {
    if (!targetMember || !targetMember.moderatable) {
      await message.reply({
        content: "❌ I cannot timeout this member (higher role or missing permissions).",
      });
      return true;
    }

    const tokens = remainingArgs.split(/\s+/);
    let durationMs = 10 * 60 * 1000; // 10 minutes default
    let reason = "Muted by staff";

    if (tokens.length > 0) {
      const parsed = parseDurationMs(tokens[0]);
      if (parsed) {
        durationMs = parsed;
        reason = tokens.slice(1).join(" ").trim() || "Muted by staff";
      } else {
        reason = remainingArgs.trim() || "Muted by staff";
      }
    }

    try {
      await targetMember.timeout(durationMs, `${reason} (by ${message.author.tag})`);

      addPunishment({
        guildId: guild.id,
        userId: targetUser.id,
        username: targetUser.tag,
        kind: "timeout",
        reason,
        durationDays: Math.round((durationMs / (24 * 60 * 60 * 1000)) * 10) / 10,
        staffId: message.author.id,
        staffTag: message.author.tag,
      });

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.danger)
        .setTitle("🔇 Member Muted / Timed Out")
        .setDescription(`**${targetUser.tag}** has been timed out.`)
        .addFields(
          { name: "👤 Member", value: `${targetUser} (\`${targetUser.id}\`)`, inline: true },
          { name: "🛡️ Moderator", value: `${message.author} (\`${message.author.tag}\`)`, inline: true },
          { name: "⏳ Duration", value: `<t:${Math.floor((Date.now() + durationMs) / 1000)}:R>`, inline: true },
          { name: "📝 Reason", value: `\`${reason}\``, inline: false }
        )
        .setFooter({ text: BRAND.footer })
        .setTimestamp();

      await message.reply({ embeds: [embed] });

      if (logChannel && logChannel.isTextBased()) {
        await logChannel.send({ embeds: [embed] }).catch(() => {});
      }
    } catch (err: any) {
      await message.reply({ content: `❌ Failed to timeout member: ${err.message}` });
    }
    return true;
  }

  // 5. UNMUTE / UNTIMEOUT
  if (commandName === "unmute" || commandName === "untimeout") {
    if (!targetMember) {
      await message.reply({ content: "❌ Member is not currently in this server." });
      return true;
    }

    try {
      await targetMember.timeout(null, `Unmuted by ${message.author.tag}`);
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.success)
        .setTitle("🔊 Member Unmuted / Timeout Removed")
        .setDescription(`**${targetUser.tag}**'s timeout has been removed.`)
        .addFields({
          name: "Moderator",
          value: `${message.author} (\`${message.author.tag}\`)`,
          inline: true,
        })
        .setFooter({ text: BRAND.footer })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (err: any) {
      await message.reply({ content: `❌ Failed to remove timeout: ${err.message}` });
    }
    return true;
  }

  // 6. KICK
  if (commandName === "kick") {
    if (!targetMember || !targetMember.kickable) {
      await message.reply({ content: "❌ I cannot kick this member (higher role or missing permissions)." });
      return true;
    }

    const reason = remainingArgs.trim() || "Kicked by staff";
    try {
      await targetMember.kick(`${reason} (by ${message.author.tag})`);

      addPunishment({
        guildId: guild.id,
        userId: targetUser.id,
        username: targetUser.tag,
        kind: "kick",
        reason,
        durationDays: null,
        staffId: message.author.id,
        staffTag: message.author.tag,
      });

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.warning)
        .setTitle("👢 Member Kicked from Server")
        .setDescription(`**${targetUser.tag}** has been kicked from the server.`)
        .addFields(
          { name: "👤 Member", value: `${targetUser} (\`${targetUser.id}\`)`, inline: true },
          { name: "🛡️ Moderator", value: `${message.author} (\`${message.author.tag}\`)`, inline: true },
          { name: "📝 Reason", value: `\`${reason}\``, inline: false }
        )
        .setFooter({ text: BRAND.footer })
        .setTimestamp();

      await message.reply({ embeds: [embed] });

      if (logChannel && logChannel.isTextBased()) {
        await logChannel.send({ embeds: [embed] }).catch(() => {});
      }
    } catch (err: any) {
      await message.reply({ content: `❌ Failed to kick member: ${err.message}` });
    }
    return true;
  }

  // 7. BAN
  if (commandName === "ban") {
    if (targetMember && !targetMember.bannable) {
      await message.reply({ content: "❌ I cannot ban this member (higher role or missing permissions)." });
      return true;
    }

    const reason = remainingArgs.trim() || "Banned by staff";
    try {
      await guild.members.ban(targetUser.id, {
        reason: `${reason} (by ${message.author.tag})`,
      });

      addPunishment({
        guildId: guild.id,
        userId: targetUser.id,
        username: targetUser.tag,
        kind: "ban",
        reason,
        durationDays: null,
        staffId: message.author.id,
        staffTag: message.author.tag,
      });

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.danger)
        .setTitle("🔨 Member Banned from Server")
        .setDescription(`**${targetUser.tag}** has been permanently banned from the server.`)
        .addFields(
          { name: "👤 Member", value: `${targetUser} (\`${targetUser.id}\`)`, inline: true },
          { name: "🛡️ Moderator", value: `${message.author} (\`${message.author.tag}\`)`, inline: true },
          { name: "📝 Reason", value: `\`${reason}\``, inline: false }
        )
        .setFooter({ text: BRAND.footer })
        .setTimestamp();

      await message.reply({ embeds: [embed] });

      if (logChannel && logChannel.isTextBased()) {
        await logChannel.send({ embeds: [embed] }).catch(() => {});
      }
    } catch (err: any) {
      await message.reply({ content: `❌ Failed to ban member: ${err.message}` });
    }
    return true;
  }

  return false;
}
