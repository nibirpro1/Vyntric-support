import {
  Events,
  Message,
  EmbedBuilder,
} from "discord.js";
import { findMatchingResponse } from "../lib/autoResponderStore";
import { findTicketByChannel } from "../lib/store";
import { BRAND } from "../lib/brand";
import { cacheMessage, logCommandExecution, logMessageSent } from "../lib/loggingStore";
import { executeAutoModCheck } from "../lib/automodEngine";

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
    // 1. AUTOMOD SYSTEM (Bug-fixed + Multi-language Gali Filter)
    // ─────────────────────────────────────────────────────────────
    const autoModViolated = await executeAutoModCheck(message, false);
    if (autoModViolated) {
      return; // Message handled by AutoMod, skip auto-responders
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
