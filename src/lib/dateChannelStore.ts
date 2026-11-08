import fs from "fs";
import path from "path";
import {
  ChannelType,
  Guild,
  GuildChannel,
  OverwriteType,
  PermissionFlagsBits,
  VoiceChannel,
} from "discord.js";
import { VyntricClient } from "../structures/VyntricClient";

export interface DateChannelConfig {
  guildId: string;
  channelId: string | null;
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
    enabled: true,
    timeZone: "Asia/Dhaka",
    lastUpdatedDate: null,
  };
  configs[guildId] = { ...current, ...patch };
  saveConfigs(configs);
  return configs[guildId];
}

/**
 * Formats Voice Channel name containing real life Bangladesh date:
 * - Day (koto tarik): 09
 * - Month (koto month): Nov
 * - Year (koto sal): 2026
 * - Weekday (ki bar): Monday
 * Result: "📅 09 Nov 2026 • Monday"
 */
export function formatDateName(date: Date = new Date(), timeZone = "Asia/Dhaka"): string {
  const d = new Intl.DateTimeFormat("en-US", { timeZone, day: "2-digit" }).format(date);
  const m = new Intl.DateTimeFormat("en-US", { timeZone, month: "short" }).format(date);
  const y = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric" }).format(date);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(date);

  return `📅 ${d} ${m} ${y} • ${weekday}`;
}

export function getCurrentDateKey(date: Date = new Date(), timeZone = "Asia/Dhaka"): string {
  const y = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric" }).format(date);
  const m = new Intl.DateTimeFormat("en-US", { timeZone, month: "2-digit" }).format(date);
  const d = new Intl.DateTimeFormat("en-US", { timeZone, day: "2-digit" }).format(date);
  return `${y}-${m}-${d}`;
}

/**
 * Creates or synchronizes the automated date Voice Channel (VC) placed at position 0 (above ticket-kiddowit).
 */
export async function syncDateChannel(
  guild: Guild,
  forceUpdate = false
): Promise<{ channel: VoiceChannel; updated: boolean }> {
  const config = getDateChannelConfig(guild.id);
  const now = new Date();
  const targetName = formatDateName(now, config.timeZone);
  const dateKey = getCurrentDateKey(now, config.timeZone);

  let channel: VoiceChannel | null = null;

  // 1. Try to find existing channel from config
  if (config.channelId) {
    const existing = guild.channels.cache.get(config.channelId);
    if (existing && existing.type === ChannelType.GuildVoice) {
      channel = existing as VoiceChannel;
    } else {
      try {
        const fetched = await guild.channels.fetch(config.channelId);
        if (fetched && fetched.type === ChannelType.GuildVoice) {
          channel = fetched as VoiceChannel;
        }
      } catch {
        channel = null;
      }
    }
  }

  // 2. Fallback: look for voice channel starting with 📅
  if (!channel) {
    const found = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildVoice && c.name.startsWith("📅")
    );
    if (found) {
      channel = found as VoiceChannel;
      updateDateChannelConfig(guild.id, { channelId: channel.id });
    }
  }

  // 3. Remove any lingering legacy text date channels
  const legacyText = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && c.name.startsWith("📅")
  );
  if (legacyText) {
    await legacyText.delete("Replaced by live date Voice Channel").catch(() => {});
  }

  let updated = false;

  // 4. Create Voice Channel if it still doesn't exist
  if (!channel) {
    const me = guild.members.me ?? (await guild.members.fetchMe());
    channel = (await guild.channels.create({
      name: targetName,
      type: ChannelType.GuildVoice,
      position: 0,
      reason: "Plugsy automated live date Voice Channel (above ticket-kiddowit)",
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          type: OverwriteType.Role,
          allow: [PermissionFlagsBits.ViewChannel],
          deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
        },
        {
          id: me.id,
          type: OverwriteType.Member,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.Connect,
          ],
        },
      ],
    })) as VoiceChannel;

    await channel.setPosition(0).catch(() => {});
    updateDateChannelConfig(guild.id, {
      channelId: channel.id,
      lastUpdatedDate: dateKey,
    });

    return { channel, updated: true };
  }

  // 5. If channel exists, check if name or position needs updating
  if (channel.name !== targetName || forceUpdate || config.lastUpdatedDate !== dateKey) {
    if (channel.name !== targetName) {
      await channel.setName(targetName, "Bangladesh real life date rollover").catch((err) => {
        console.warn("[dateChannel:setName:error]", err.message);
      });
    }

    if (channel.position > 0) {
      await channel.setPosition(0).catch(() => {});
    }

    updateDateChannelConfig(guild.id, {
      channelId: channel.id,
      lastUpdatedDate: dateKey,
    });
    updated = true;
  }

  return { channel, updated };
}

let syncInterval: NodeJS.Timeout | null = null;

/**
 * Initializes automatic background date sync across all served guilds.
 * Runs every 5 minutes to continuously match real-life Bangladesh time (Asia/Dhaka).
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

  // Check every 5 minutes continuously
  syncInterval = setInterval(runSync, 5 * 60 * 1000);
}
