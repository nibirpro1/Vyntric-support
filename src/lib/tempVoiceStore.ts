import fs from "fs";
import path from "path";

export interface TempChannelStatusSettings {
  isMuted: boolean;
  extraOwners: string[]; // User IDs who can control status panel
  whitelist: string[];   // User IDs targeted by mute-all
  blacklist: string[];   // User IDs immune to mute-all
}

export interface TempChannelRecord {
  channelId: string;
  guildId: string;
  ownerId: string;
  createdAt: number;
  isLocked: boolean;
  isHidden?: boolean;
  trustedUserIds: string[];
  blockedUserIds: string[];
  waitingRoomChannelId?: string | null;
  chatLocked?: boolean;
  interfaceMessageId?: string | null;
  bitrate?: number;
  slowmode?: number;
  coOwners?: string[];
  notificationsEnabled?: boolean;
  statusSettings?: TempChannelStatusSettings;
}

export interface TempVoiceConfig {
  enabled: boolean;
  creatorChannelId: string;
  categoryId: string;
  interfaceChannelId: string;
  interfaceMessageId?: string;
  defaultNameTemplate: string; // e.g. "! {user}'s Channel"
  defaultUserLimit: number;
}

interface TempVoiceData {
  configs: Record<string, TempVoiceConfig>; // guildId -> config
  channels: Record<string, TempChannelRecord>; // channelId -> record
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "tempVoice.json");

const DEFAULT_CONFIG: TempVoiceConfig = {
  enabled: true,
  creatorChannelId: "1572303632622289047", // "Create vc" in Vyntric J2C
  categoryId: "1572303631246434436", // "J2C" Category
  interfaceChannelId: "1572303634178248946", // "interface" channel
  defaultNameTemplate: "! {user}'s Channel",
  defaultUserLimit: 0,
};

let cache: TempVoiceData = {
  configs: {},
  channels: {},
};

function ensureLoaded(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(FILE_PATH)) {
      const raw = fs.readFileSync(FILE_PATH, "utf8");
      cache = JSON.parse(raw);
      if (!cache.configs) cache.configs = {};
      if (!cache.channels) cache.channels = {};
    } else {
      cache = { configs: {}, channels: {} };
      save();
    }
  } catch (err) {
    console.error("[tempVoiceStore:load:error]", err);
    cache = { configs: {}, channels: {} };
  }
}

function save(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(FILE_PATH, JSON.stringify(cache, null, 2), "utf8");
  } catch (err) {
    console.error("[tempVoiceStore:save:error]", err);
  }
}

ensureLoaded();

export function getTempVoiceConfig(guildId: string): TempVoiceConfig {
  ensureLoaded();
  if (!cache.configs[guildId]) {
    cache.configs[guildId] = { ...DEFAULT_CONFIG };
    save();
  }
  return cache.configs[guildId];
}

export function setTempVoiceConfig(
  guildId: string,
  updates: Partial<TempVoiceConfig>
): TempVoiceConfig {
  ensureLoaded();
  const current = getTempVoiceConfig(guildId);
  cache.configs[guildId] = { ...current, ...updates };
  save();
  return cache.configs[guildId];
}

export function getTempChannel(channelId: string): TempChannelRecord | undefined {
  ensureLoaded();
  return cache.channels[channelId];
}

export function getTempChannelByOwner(
  guildId: string,
  ownerId: string
): TempChannelRecord | undefined {
  ensureLoaded();
  return Object.values(cache.channels).find(
    (c) => c.guildId === guildId && c.ownerId === ownerId
  );
}

export function saveTempChannel(record: TempChannelRecord): void {
  ensureLoaded();
  cache.channels[record.channelId] = record;
  save();
}

export function deleteTempChannel(channelId: string): void {
  ensureLoaded();
  if (cache.channels[channelId]) {
    delete cache.channels[channelId];
    save();
  }
}

export function getAllTempChannels(guildId: string): TempChannelRecord[] {
  ensureLoaded();
  return Object.values(cache.channels).filter((c) => c.guildId === guildId);
}

export function getStatusSettings(channelId: string): TempChannelStatusSettings {
  ensureLoaded();
  const rec = cache.channels[channelId];
  if (!rec) {
    return { isMuted: false, extraOwners: [], whitelist: [], blacklist: [] };
  }
  if (!rec.statusSettings) {
    rec.statusSettings = { isMuted: false, extraOwners: [], whitelist: [], blacklist: [] };
    save();
  }
  return rec.statusSettings;
}

export function updateStatusSettings(
  channelId: string,
  settings: Partial<TempChannelStatusSettings>
): TempChannelStatusSettings {
  ensureLoaded();
  const rec = cache.channels[channelId];
  if (!rec) {
    return { isMuted: false, extraOwners: [], whitelist: [], blacklist: [] };
  }
  const current = rec.statusSettings || { isMuted: false, extraOwners: [], whitelist: [], blacklist: [] };
  rec.statusSettings = { ...current, ...settings };
  save();
  return rec.statusSettings;
}
