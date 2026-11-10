import {
  Events,
  Message,
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
} from "discord.js";
import { getAutoModConfig } from "../lib/automodStore";
import { findMatchingResponse } from "../lib/autoResponderStore";
import { findTicketByChannel, getSettings } from "../lib/store";
import { BRAND } from "../lib/brand";
import { cacheMessage, logCommandExecution, logMessageSent } from "../lib/loggingStore";

// In-memory spam tracker: userId -> timestamp[]
const userMessageTimes: Map<string, number[]> = new Map();
// Message deduplication cache: messageId -> boolean
const handledMessageIds = new Set<string>();

export default {
  name: Events.MessageCreate,
  once: false,
  async execute(message: Message) {
    if (!message.guild) return;

    // Handle other bots and slash command logging
    if (message.author.bot) {
      // Check if this message was triggered by a slash command from another bot
      if (message.interaction && message.author.id !== message.client.user?.id) {
        await logCommandExecution({
          guild: message.guild,
          user: message.interaction.user,
          channelId: message.channel.id,
          commandName: message.interaction.commandName,
          fullCommand: `/${message.interaction.commandName} (via @${message.author.username})`,
        });
      }

      // Silence other bots inside active ticket channels
      if (message.author.id !== message.client.user.id) {
        const ticket = findTicketByChannel(message.channel.id);
        if (ticket && ticket.status === "open") {
          await message.delete().catch(() => {});
        }
      }
      return;
    }

    // Deduplicate in case of duplicate gateway events
    if (handledMessageIds.has(message.id)) return;
    handledMessageIds.add(message.id);
    setTimeout(() => handledMessageIds.delete(message.id), 15_000);

    const guild = message.guild;
    const member = message.member;
    const content = message.content;

    // Cache message for Carl-bot style edit/delete audit logging
    cacheMessage(message);

    // Carl-bot style Message Sent audit logging (logs all messages sent in the server to # messege)
    logMessageSent(message);

    // ─────────────────────────────────────────────────────────────
    // COMMAND AUDIT LOGGING (Prefix commands: !, ?, ., -, +, $, ;, /, etc.)
    // ─────────────────────────────────────────────────────────────
    const trimmed = (content || "").trim();
    if (trimmed.length > 1) {
      const PREFIX_REGEX = /^[!?.+\-$&,;~*%^>_/]/;
      const MULTI_PREFIX_REGEX = /^(m!|p!|c!|d!|s!|w!|j!|t!|k!|g!|r!|b!)/i;
      const KNOWN_COMMANDS = new Set([
        "listmods",
        "lock",
        "unlock",
        "ban",
        "kick",
        "mute",
        "unmute",
        "warn",
        "clear",
        "purge",
        "slowmode",
        "ticket",
        "close",
        "help",
        "rank",
        "ping",
      ]);

      let detectedCommand: string | null = null;

      if (PREFIX_REGEX.test(trimmed)) {
        const firstWord = trimmed.slice(1).trim().split(/\s+/)[0];
        if (
          firstWord &&
          firstWord.length > 0 &&
          firstWord.length < 32 &&
          /^[a-zA-Z0-9_-]+$/.test(firstWord)
        ) {
          detectedCommand = firstWord.toLowerCase();
        }
      } else if (MULTI_PREFIX_REGEX.test(trimmed)) {
        const firstWord = trimmed.replace(MULTI_PREFIX_REGEX, "").trim().split(/\s+/)[0];
        if (
          firstWord &&
          firstWord.length > 0 &&
          firstWord.length < 32 &&
          /^[a-zA-Z0-9_-]+$/.test(firstWord)
        ) {
          detectedCommand = firstWord.toLowerCase();
        }
      } else {
        const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase();
        if (firstWord && KNOWN_COMMANDS.has(firstWord)) {
          detectedCommand = firstWord;
        }
      }

      if (detectedCommand) {
        await logCommandExecution({
          guild,
          user: message.author,
          channelId: message.channel.id,
          commandName: detectedCommand,
          fullCommand: trimmed,
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 1. AUTOMOD SYSTEM
    // ─────────────────────────────────────────────────────────────
    const autoMod = getAutoModConfig(guild.id);
    const settings = getSettings(guild.id);

    // Discord Administrators & Staff are ALWAYS immune - never auto-delete admin messages
    const isAdmin =
      member?.permissions.has(PermissionFlagsBits.Administrator) ||
      member?.permissions.has(PermissionFlagsBits.ManageGuild);
    const isStaff = member?.roles.cache.some((r) =>
      settings.staffRoleIds?.includes(r.id)
    );
    const isImmune = isAdmin || isStaff || autoMod.adminImmunity;

    if (autoMod.enabled && !isImmune) {
      let violated = false;
      let violationReason = "";

      // A. Anti-Invite Check
      if (
        autoMod.antiInvite &&
        /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite|dsc\.gg)\/[a-z0-9_-]+/i.test(content)
      ) {
        violated = true;
        violationReason = "Discord Invite Link";
      }

      // B. Anti-Link Check
      if (
        !violated &&
        autoMod.antiLink &&
        /https?:\/\/[^\s]+/i.test(content)
      ) {
        violated = true;
        violationReason = "Unauthorized Link";
      }

      // C. Anti-Mass-Mention Check
      if (!violated && autoMod.antiMention) {
        const totalMentions = message.mentions.users.size + message.mentions.roles.size;
        if (totalMentions > 4) {
          violated = true;
          violationReason = `Mass Mention (${totalMentions} mentions)`;
        }
      }

      // D. Anti-Spam Check (Rate limit: > 4 messages in 3 seconds)
      if (!violated && autoMod.antiSpam) {
        const now = Date.now();
        const timestamps = userMessageTimes.get(message.author.id) || [];
        const recent = timestamps.filter((t) => now - t < 3000);
        recent.push(now);
        userMessageTimes.set(message.author.id, recent);

        if (recent.length > 4) {
          violated = true;
          violationReason = "Spamming Messages";
          userMessageTimes.set(message.author.id, []); // reset
        }
      }

      // E. Bad Words Blacklist Check
      if (!violated && autoMod.badWords && autoMod.badWords.length > 0) {
        const lower = content.toLowerCase();
        for (const rawWord of autoMod.badWords) {
          const word = rawWord.trim().toLowerCase();
          if (!word) continue;

          let matches = false;
          if (word.includes(" ")) {
            matches = lower.includes(word);
          } else if (/^[a-zA-Z0-9]+$/.test(word)) {
            matches = new RegExp(`(?<=^|[^a-zA-Z0-9])${word}(?=$|[^a-zA-Z0-9])`, "i").test(lower);
          } else {
            matches = lower.includes(word);
          }

          if (matches) {
            violated = true;
            violationReason = `Banned Word (${word})`;
            break;
          }
        }
      }

      // If violation triggered
      if (violated) {
        try {
          await message.delete().catch(() => {});

          // Apply timeout if configured and possible
          if (member?.moderatable && autoMod.punishment.startsWith("timeout_")) {
            let durationMs = 60_000; // 1m
            if (autoMod.punishment === "timeout_5m") durationMs = 300_000;
            if (autoMod.punishment === "timeout_10m") durationMs = 600_000;
            await member.timeout(durationMs, `AutoMod: ${violationReason}`).catch(() => {});
          }

          // Send warning message and self-delete after 5 seconds
          if (message.channel && "send" in message.channel) {
            const warnMsg = await (message.channel as TextChannel).send({
              content: `⚠️ **${message.author}**, your message was removed by **${BRAND.name} AutoMod** [Reason: \`${violationReason}\`]`,
            });
            setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
          }

          // Log infraction to mod log channel
          if (autoMod.logChannelId) {
            const logChan = guild.channels.cache.get(autoMod.logChannelId) as TextChannel | undefined;
            if (logChan && logChan.isTextBased()) {
              const logEmbed = new EmbedBuilder()
                .setColor(BRAND.colors.danger)
                .setTitle(`🛡️ ${BRAND.name} AutoMod Action Taken`)
                .setDescription(
                  [
                    `👤 **Member:** ${message.author} (\`${message.author.tag}\`)`,
                    `📍 **Channel:** ${message.channel}`,
                    `⚠️ **Reason:** \`${violationReason}\``,
                    `🔨 **Punishment:** \`${autoMod.punishment}\``,
                    "",
                    "**Deleted Content:**",
                    `\`\`\`\n${content.slice(0, 800) || "[No text / media]"}\n\`\`\``,
                  ].join("\n")
                )
                .setTimestamp();

              await logChan.send({ embeds: [logEmbed] }).catch(() => {});
            }
          }
        } catch (err) {
          console.error("[automod:action:error]", err);
        }
        return; // Don't process autoresponders for offending message
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. AUTO-RESPONDER SYSTEM
    // ─────────────────────────────────────────────────────────────
    const match = findMatchingResponse(guild.id, content);
    if (match) {
      const formatted = match.response
        .replace(/{user}/g, `<@${message.author.id}>`)
        .replace(/{username}/g, message.author.username)
        .replace(/{server}/g, guild.name)
        .replace(/{channel}/g, `<#${message.channel.id}>`);

      try {
        if (match.useEmbed) {
          const embed = new EmbedBuilder()
            .setColor(BRAND.colors.primary)
            .setDescription(formatted)
            .setFooter({ text: BRAND.footer });

          await message.reply({ embeds: [embed] });
        } else {
          await message.reply({ content: formatted });
        }
      } catch (err) {
        console.error("[autoresponder:reply:error]", err);
      }
    }
  },
};
