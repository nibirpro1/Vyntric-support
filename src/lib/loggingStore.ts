import fs from "fs";
import path from "path";
import { EmbedBuilder, Guild, Message, PartialMessage, TextChannel, User, VoiceState } from "discord.js";
import { getTempVoiceConfig } from "./tempVoiceStore";

export interface CachedMessage {
  id: string;
  authorId: string;
  authorTag: string;
  authorAvatar: string | null;
  content: string;
  channelId: string;
  guildId: string;
  attachments: Array<{ name: string; url: string }>;
  createdAt: number;
}

export interface LoggingConfig {
  guildId: string;
  logChannelId: string | null;            // General fallback
  messageLogChannelId: string | null;     // Carl-bot style message edit/delete log (e.g. # messege)
  commandLogChannelId: string | null;     // Dyno style command log (e.g. # command-log)
  voiceLogChannelId: string | null;       // Voice channel join/leave/switch log (e.g. # join-log)
  messageSend: boolean;
  messageDelete: boolean;
  messageUpdate: boolean;
  commandLog: boolean;
  voiceLog: boolean;
  memberUpdate: boolean;
  updatedAt: number;
}

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");
const LOG_FILE = path.join(DATA_DIR, "logs_config.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): Record<string, LoggingConfig> {
  try {
    ensureDir();
    if (!fs.existsSync(LOG_FILE)) return {};
    const raw = fs.readFileSync(LOG_FILE, "utf8").trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.error("[loggingStore] Read error:", err);
    return {};
  }
}

let store: Record<string, LoggingConfig> = readStore();

function persist() {
  try {
    ensureDir();
    const tmp = `${LOG_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
    fs.renameSync(tmp, LOG_FILE);
  } catch (err) {
    console.error("[loggingStore] Persist error:", err);
  }
}

export function getLoggingConfig(guildId: string): LoggingConfig {
  if (!store[guildId]) {
    store[guildId] = {
      guildId,
      logChannelId: "1548374744695447623",
      messageLogChannelId: "1548374744695447623", // # messege
      commandLogChannelId: "1508519539388977163", // # command-log
      voiceLogChannelId: "1508548021808398346",   // # join-log
      messageSend: true,
      messageDelete: true,
      messageUpdate: true,
      commandLog: true,
      voiceLog: true,
      memberUpdate: true,
      updatedAt: Date.now(),
    };
    persist();
  }
  // Ensure default channels if properties are missing
  if (!store[guildId].messageLogChannelId) {
    store[guildId].messageLogChannelId = "1548374744695447623";
  }
  if (!store[guildId].commandLogChannelId) {
    store[guildId].commandLogChannelId = "1508519539388977163";
  }
  if (!store[guildId].voiceLogChannelId) {
    store[guildId].voiceLogChannelId = "1508548021808398346";
  }
  if (store[guildId].messageSend === undefined) {
    store[guildId].messageSend = true;
  }
  if (store[guildId].commandLog === undefined) {
    store[guildId].commandLog = true;
  }
  if (store[guildId].voiceLog === undefined) {
    store[guildId].voiceLog = true;
  }
  return store[guildId];
}

export function updateLoggingConfig(
  guildId: string,
  updates: Partial<LoggingConfig>
): LoggingConfig {
  const current = getLoggingConfig(guildId);
  const updated: LoggingConfig = {
    ...current,
    ...updates,
    updatedAt: Date.now(),
  };
  store[guildId] = updated;
  persist();
  return updated;
}

// ─────────────────────────────────────────────────────────────
// IN-MEMORY MESSAGE CACHE (Up to 5,000 recent messages)
// ─────────────────────────────────────────────────────────────
const messageCache = new Map<string, CachedMessage>();
const MAX_CACHE_SIZE = 5000;

export function cacheMessage(message: Message) {
  if (!message.guild || message.author?.bot) return;

  // Evict oldest if exceeding size
  if (messageCache.size >= MAX_CACHE_SIZE) {
    const firstKey = messageCache.keys().next().value;
    if (firstKey) messageCache.delete(firstKey);
  }

  messageCache.set(message.id, {
    id: message.id,
    authorId: message.author.id,
    authorTag: message.author.tag,
    authorAvatar: message.author.displayAvatarURL(),
    content: message.content || "",
    channelId: message.channelId,
    guildId: message.guild.id,
    attachments: message.attachments.map((a) => ({ name: a.name, url: a.url })),
    createdAt: message.createdTimestamp,
  });
}

export function getCachedMessage(messageId: string): CachedMessage | undefined {
  return messageCache.get(messageId);
}

// ─────────────────────────────────────────────────────────────
// CENTRAL COMMAND AUDIT LOGGER (Dyno-style)
// ─────────────────────────────────────────────────────────────
export async function logCommandExecution(options: {
  guild: Guild;
  user: User;
  channelId: string;
  commandName: string;
  fullCommand: string;
}) {
  const { guild, user, channelId, commandName, fullCommand } = options;

  const config = getLoggingConfig(guild.id);
  const cmdChannelId = config.commandLogChannelId || "1508519539388977163";
  if (!config.commandLog || !cmdChannelId) return;

  try {
    const cmdChannel =
      (guild.channels.cache.get(cmdChannelId) as TextChannel | undefined) ||
      ((await guild.channels.fetch(cmdChannelId).catch(() => null)) as TextChannel | null);

    if (cmdChannel && cmdChannel.isTextBased()) {
      const embed = new EmbedBuilder()
        .setColor(0x0099ff) // Dyno Blue
        .setAuthor({
          name: user.tag,
          iconURL: user.displayAvatarURL(),
        })
        .setDescription(
          `Used \`${commandName}\` command in <#${channelId}>\n` +
            `\`${fullCommand.slice(0, 500)}\``
        )
        .setFooter({ text: `${user.id}` })
        .setTimestamp();

      await cmdChannel.send({ embeds: [embed] }).catch(() => {});
    }
  } catch (err) {
    console.error("[log:commandExecution:error]", err);
  }
}

// ─────────────────────────────────────────────────────────────
// MESSAGE SENT LOGGER (Carl-bot style: all server messages)
// ─────────────────────────────────────────────────────────────
export async function logMessageSent(message: Message) {
  if (!message.guild || message.author.id === message.client.user?.id) return;

  const config = getLoggingConfig(message.guild.id);
  const targetChannelId = config.messageLogChannelId || config.logChannelId;
  if (!targetChannelId || !config.messageSend) return;

  // Prevent self-looping on the log channels
  const ignoredChannels = [
    targetChannelId,
    config.commandLogChannelId,
    "1508519539388977163", // command-log
    "1548374744695447623", // messege
    "1569042414474231988", // log-channel-verify
    "1508548021808398346", // join-log
  ];
  if (ignoredChannels.includes(message.channelId)) return;

  try {
    const channel =
      (message.guild.channels.cache.get(targetChannelId) as TextChannel | undefined) ||
      ((await message.guild.channels.fetch(targetChannelId).catch(() => null)) as TextChannel | null);

    if (!channel || !channel.isTextBased()) return;

    const content = message.content ? message.content.slice(0, 1500) : "_[No text content]_";

    const embed = new EmbedBuilder()
      .setColor(0x2fbf71) // Carl-bot Green for Message Sent
      .setAuthor({
        name: message.author.tag,
        iconURL: message.author.displayAvatarURL(),
      })
      .setDescription(
        `**Message sent in <#${message.channelId}>** [Jump to Message](${message.url})\n\n${content}`
      );

    if (message.attachments.size > 0) {
      const attachments = message.attachments.map((a) => `[${a.name}](${a.url})`).join("\n");
      embed.addFields({
        name: `📎 Attachments (${message.attachments.size})`,
        value: attachments,
      });

      const firstImage = message.attachments.find(
        (a) => a.contentType?.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(a.name)
      );
      if (firstImage) {
        embed.setImage(firstImage.url);
      }
    }

    embed.setFooter({ text: `ID: ${message.author.id} • Message ID: ${message.id}` });
    embed.setTimestamp();

    await channel.send({ embeds: [embed] }).catch(() => {});
  } catch (err) {
    console.error("[log:messageSent:error]", err);
  }
}

// ─────────────────────────────────────────────────────────────
// VOICE CHANNEL JOIN / LEAVE / MOVE LOGGER (#join-log)
// ─────────────────────────────────────────────────────────────
export async function logVoiceChannelActivity(
  oldState: VoiceState,
  newState: VoiceState
): Promise<void> {
  const member = newState.member || oldState.member;
  const guild = newState.guild || oldState.guild;
  if (!member || !guild || member.user.bot) return;

  const oldChannelId = oldState.channelId;
  const newChannelId = newState.channelId;

  // If voice channel didn't change (e.g. only mute/deafen/stream toggles), skip join-log
  if (oldChannelId === newChannelId) return;

  const tempConfig = getTempVoiceConfig(guild.id);
  const creatorId = tempConfig?.creatorChannelId;

  // If user is joining the generator lobby ("Create vc"), skip logging this intermediate step
  if (newChannelId && newChannelId === creatorId) {
    return;
  }

  // If moving out of the generator lobby to their created channel, treat as a direct Join
  const isFromLobby = Boolean(oldChannelId && oldChannelId === creatorId);
  const isDirectJoin = (!oldChannelId && newChannelId) || (isFromLobby && Boolean(newChannelId));

  const config = getLoggingConfig(guild.id);
  const targetChannelId = config.voiceLogChannelId || "1508548021808398346";
  if (!config.voiceLog || !targetChannelId) return;

  try {
    const channel =
      (guild.channels.cache.get(targetChannelId) as TextChannel | undefined) ||
      ((await guild.channels.fetch(targetChannelId).catch(() => null)) as TextChannel | null);

    if (!channel || !channel.isTextBased()) return;

    let embed: EmbedBuilder | null = null;

    if (isDirectJoin && newChannelId) {
      // 1. JOINED VOICE CHANNEL
      const voiceChannel = newState.channel;
      const count = voiceChannel?.members.size || 1;
      embed = new EmbedBuilder()
        .setColor(0x2ecc71) // Green
        .setAuthor({
          name: `${member.user.tag} (${member.user.username})`,
          iconURL: member.user.displayAvatarURL(),
        })
        .setTitle("🔊 Voice Channel Joined")
        .setDescription(`**${member}** joined voice channel <#${newChannelId}>`)
        .addFields(
          { name: "👤 User", value: `${member} (\`${member.user.tag}\`)`, inline: true },
          { name: "📥 Channel", value: `<#${newChannelId}>\n\`#${voiceChannel?.name || "Voice Channel"}\``, inline: true },
          { name: "👥 Members in Room", value: `**${count}** member${count === 1 ? "" : "s"}`, inline: true }
        )
        .setFooter({ text: `User ID: ${member.id} • Channel ID: ${newChannelId}` })
        .setTimestamp();
    } else if (oldChannelId && !newChannelId && !isFromLobby) {
      // 2. LEFT VOICE CHANNEL
      const voiceChannel = oldState.channel;
      const remaining = voiceChannel?.members.size || 0;
      embed = new EmbedBuilder()
        .setColor(0xe74c3c) // Red
        .setAuthor({
          name: `${member.user.tag} (${member.user.username})`,
          iconURL: member.user.displayAvatarURL(),
        })
        .setTitle("🔇 Voice Channel Left")
        .setDescription(`**${member}** left voice channel <#${oldChannelId}>`)
        .addFields(
          { name: "👤 User", value: `${member} (\`${member.user.tag}\`)`, inline: true },
          { name: "📤 Channel", value: `<#${oldChannelId}>\n\`#${voiceChannel?.name || "Voice Channel"}\``, inline: true },
          { name: "👥 Remaining in Room", value: `**${remaining}** member${remaining === 1 ? "" : "s"}`, inline: true }
        )
        .setFooter({ text: `User ID: ${member.id} • Channel ID: ${oldChannelId}` })
        .setTimestamp();
    } else if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
      // 3. SWITCHED / MOVED VOICE CHANNEL
      const fromChannel = oldState.channel;
      const toChannel = newState.channel;
      embed = new EmbedBuilder()
        .setColor(0x3498db) // Blue
        .setAuthor({
          name: `${member.user.tag} (${member.user.username})`,
          iconURL: member.user.displayAvatarURL(),
        })
        .setTitle("🔀 Voice Channel Switched")
        .setDescription(`**${member}** switched voice channels`)
        .addFields(
          { name: "👤 User", value: `${member} (\`${member.user.tag}\`)`, inline: false },
          { name: "📤 Left Channel", value: `<#${oldChannelId}> (\`#${fromChannel?.name || "Voice"}\`)`, inline: true },
          { name: "📥 Joined Channel", value: `<#${newChannelId}> (\`#${toChannel?.name || "Voice"}\`)`, inline: true }
        )
        .setFooter({ text: `User ID: ${member.id}` })
        .setTimestamp();
    }

    if (embed) {
      await channel.send({ embeds: [embed] }).catch(() => {});
    }
  } catch (err) {
    console.error("[log:voiceActivity:error]", err);
  }
}



