import fs from "fs";
import path from "path";
import {
  ChannelType,
  EmbedBuilder,
  Guild,
  OverwriteType,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import { VyntricClient } from "../structures/VyntricClient";

export interface DateChannelConfig {
  guildId: string;
  channelId: string | null;
  messageId: string | null;
  enabled: boolean;
  timeZone: string;
  lastUpdatedDate: string | null;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const CONFIG_FILE = path.join(DATA_DIR, "dateChannel.json");

function ensureDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadConfigs(): Record<string, DateChannelConfig> {
  ensureDirectory();
  if (!fs.existsSync(CONFIG_FILE)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("[dateChannel:loadError]", err);
    return {};
  }
}

function saveConfigs(configs: Record<string, DateChannelConfig>) {
  ensureDirectory();
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2), "utf-8");
  } catch (err) {
    console.error("[dateChannel:saveError]", err);
  }
}

export function getDateChannelConfig(guildId: string): DateChannelConfig {
  const configs = loadConfigs();
  if (!configs[guildId]) {
    configs[guildId] = {
      guildId,
      channelId: null,
      messageId: null,
      enabled: true,
      timeZone: "Asia/Dhaka",
      lastUpdatedDate: null,
    };
    saveConfigs(configs);
  }
  return configs[guildId];
}

export function updateDateChannelConfig(
  guildId: string,
  patch: Partial<DateChannelConfig>
): DateChannelConfig {
  const configs = loadConfigs();
  const current = configs[guildId] || {
    guildId,
    channelId: null,
    messageId: null,
    enabled: true,
    timeZone: "Asia/Dhaka",
    lastUpdatedDate: null,
  };
  configs[guildId] = { ...current, ...patch };
  saveConfigs(configs);
  return configs[guildId];
}

/**
 * Formats channel name containing:
 * - Day (koto tarik): e.g. 09
 * - Month (koto month): e.g. nov
 * - Year (koto sal): e.g. 2026
 * - Weekday (ki bar): e.g. monday
 */
export function formatDateName(date: Date = new Date(), timeZone = "Asia/Dhaka"): string {
  const d = new Intl.DateTimeFormat("en-US", { timeZone, day: "2-digit" }).format(date);
  const m = new Intl.DateTimeFormat("en-US", { timeZone, month: "short" }).format(date).toLowerCase();
  const y = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric" }).format(date);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(date).toLowerCase();

  return `📅・${d}-${m}-${y}・${weekday}`;
}

export function getCurrentDateKey(date: Date = new Date(), timeZone = "Asia/Dhaka"): string {
  const y = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric" }).format(date);
  const m = new Intl.DateTimeFormat("en-US", { timeZone, month: "2-digit" }).format(date);
  const d = new Intl.DateTimeFormat("en-US", { timeZone, day: "2-digit" }).format(date);
  return `${y}-${m}-${d}`;
}

export function buildDateEmbed(date: Date = new Date(), timeZone = "Asia/Dhaka"): EmbedBuilder {
  const fullDate = new Intl.DateTimeFormat("en-US", {
    timeZone,
    dateStyle: "full",
  }).format(date);
  const unixSeconds = Math.floor(date.getTime() / 1000);

  return new EmbedBuilder()
    .setColor(0x7c3aed)
    .setTitle("📅 Vyntric Live Date & Calendar")
    .setDescription(
      [
        `### 🗓️ **${fullDate}**`,
        "",
        `⏱️ **Live Timestamp:** <t:${unixSeconds}:F> (<t:${unixSeconds}:R>)`,
        `🌐 **Timezone:** \`${timeZone}\` (GMT+6 Bangladesh Standard Time)`,
        "",
        "> 🔄 *This channel automatically updates every midnight to show the current date, month, year, and day of the week.*",
      ].join("\n")
    )
    .setFooter({ text: "Powered by Plugsy • Vyntric Live Automation" })
    .setTimestamp(date);
}

/**
 * Creates or synchronizes the automated date channel placed at position 0 (above ticket-kiddowit).
 */
export async function syncDateChannel(
  guild: Guild,
  forceUpdate = false
): Promise<{ channel: TextChannel; updated: boolean }> {
  const config = getDateChannelConfig(guild.id);
  const now = new Date();
  const targetName = formatDateName(now, config.timeZone);
  const dateKey = getCurrentDateKey(now, config.timeZone);

  let channel: TextChannel | null = null;

  // 1. Try to find existing channel from config
  if (config.channelId) {
    const existing = guild.channels.cache.get(config.channelId);
    if (existing && existing.type === ChannelType.GuildText) {
      channel = existing as TextChannel;
    } else {
      try {
        const fetched = await guild.channels.fetch(config.channelId);
        if (fetched && fetched.type === ChannelType.GuildText) {
          channel = fetched as TextChannel;
        }
      } catch {
        channel = null;
      }
    }
  }

  // 2. Fallback: look for channel starting with 📅
  if (!channel) {
    const found = guild.channels.cache.find(
      (c) => c.parentId === null && c.type === ChannelType.GuildText && c.name.startsWith("📅")
    );
    if (found) {
      channel = found as TextChannel;
      updateDateChannelConfig(guild.id, { channelId: channel.id });
    }
  }

  let updated = false;

  // 3. Create channel if it still doesn't exist
  if (!channel) {
    const me = guild.members.me ?? (await guild.members.fetchMe());
    channel = (await guild.channels.create({
      name: targetName,
      type: ChannelType.GuildText,
      position: 0,
      reason: "Plugsy automated live date channel (placed above ticket-kiddowit)",
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          type: OverwriteType.Role,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          deny: [
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.AddReactions,
            PermissionFlagsBits.CreatePublicThreads,
            PermissionFlagsBits.CreatePrivateThreads,
            PermissionFlagsBits.SendMessagesInThreads,
          ],
        },
        {
          id: me.id,
          type: OverwriteType.Member,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.PinMessages,
          ],
        },
      ],
    })) as TextChannel;

    // Ensure it's at position 0
    await channel.setPosition(0).catch(() => {});

    // Send and pin initial embed
    const embed = buildDateEmbed(now, config.timeZone);
    const msg = await channel.send({ embeds: [embed] }).catch(() => null);
    if (msg) {
      await msg.pin().catch(() => {});
      updateDateChannelConfig(guild.id, {
        channelId: channel.id,
        messageId: msg.id,
        lastUpdatedDate: dateKey,
      });
    } else {
      updateDateChannelConfig(guild.id, {
        channelId: channel.id,
        lastUpdatedDate: dateKey,
      });
    }

    return { channel, updated: true };
  }

  // 4. If channel exists, check if name or embed needs updating
  if (channel.name !== targetName || forceUpdate || config.lastUpdatedDate !== dateKey) {
    if (channel.name !== targetName) {
      await channel.setName(targetName, "Plugsy automated date rollover").catch((err) => {
        console.warn("[dateChannel:setName:error]", err.message);
      });
    }

    // Keep position at 0 above ticket-kiddowit
    if (channel.position > 0) {
      await channel.setPosition(0).catch(() => {});
    }

    // Update pinned message
    if (config.messageId) {
      try {
        const msg = await channel.messages.fetch(config.messageId);
        if (msg) {
          await msg.edit({ embeds: [buildDateEmbed(now, config.timeZone)] });
        }
      } catch {
        const newMsg = await channel.send({ embeds: [buildDateEmbed(now, config.timeZone)] }).catch(() => null);
        if (newMsg) {
          await newMsg.pin().catch(() => {});
          updateDateChannelConfig(guild.id, { messageId: newMsg.id });
        }
      }
    } else {
      const newMsg = await channel.send({ embeds: [buildDateEmbed(now, config.timeZone)] }).catch(() => null);
      if (newMsg) {
        await newMsg.pin().catch(() => {});
        updateDateChannelConfig(guild.id, { messageId: newMsg.id });
      }
    }

    updateDateChannelConfig(guild.id, { lastUpdatedDate: dateKey });
    updated = true;
  }

  return { channel, updated };
}

let syncInterval: NodeJS.Timeout | null = null;

/**
 * Initializes automatic background date sync across all served guilds.
 */
export function initDateChannelSync(client: VyntricClient) {
  if (syncInterval) clearInterval(syncInterval);

  const runSync = async () => {
    for (const guild of client.guilds.cache.values()) {
      try {
        const config = getDateChannelConfig(guild.id);
        if (config.enabled) {
          await syncDateChannel(guild);
        }
      } catch (err: any) {
        console.error(`[dateChannel:sync:error:${guild.id}]`, err.message);
      }
    }
  };

  // Run on startup
  runSync().catch(() => {});

  // Check every 10 minutes (stays comfortably under Discord's 2 renames per 10m rate limit)
  syncInterval = setInterval(runSync, 10 * 60 * 1000);
}
