import fs from "fs";
import path from "path";
import { Message, PartialMessage } from "discord.js";

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
  messageDelete: boolean;
  messageUpdate: boolean;
  commandLog: boolean;
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
      messageDelete: true,
      messageUpdate: true,
      commandLog: true,
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
  if (store[guildId].commandLog === undefined) {
    store[guildId].commandLog = true;
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
