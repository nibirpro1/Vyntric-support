import fs from "fs";
import path from "path";

export type AntiRaidAction = "timeout" | "quarantine" | "kick";

export interface AntiRaidConfig {
  guildId: string;
  enabled: boolean;
  joinRaid: {
    enabled: boolean;
    threshold: number; // e.g. 5 joins
    windowSeconds: number; // e.g. 10 seconds
    action: AntiRaidAction; // default: timeout
    timeoutMinutes: number; // default: 60 minutes
    autoLockdown: boolean; // default: true
    autoLockdownMinutes: number; // default: 15 minutes
  };
  accountAgeGate: {
    enabled: boolean;
    minAgeDays: number; // default: 3 days
    action: "timeout" | "quarantine" | "kick" | "alert"; // default: timeout
    timeoutMinutes: number; // default: 30 minutes
  };
  antiSpamRaid: {
    enabled: boolean;
    maxMessages: number; // default: 5 messages
    windowSeconds: number; // default: 3 seconds
    action: "timeout";
    timeoutMinutes: number; // default: 10 minutes
  };
  antiMentionRaid: {
    enabled: boolean;
    maxMentions: number; // default: 4 mentions in a single message
    action: "timeout";
    timeoutMinutes: number; // default: 60 minutes
  };
  whitelistedUsers: string[];
  whitelistedRoles: string[];
  logChannelId: string | null;
  activeLockdown: {
    active: boolean;
    startedAt: number;
    channelsLocked: string[];
    expiresAt?: number;
    reason?: string;
    initiatedBy?: string;
  } | null;
  updatedAt: number;
}

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");
const ANTIRAID_FILE = path.join(DATA_DIR, "antiraid.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): Record<string, AntiRaidConfig> {
  try {
    ensureDir();
    if (!fs.existsSync(ANTIRAID_FILE)) return {};
    const raw = fs.readFileSync(ANTIRAID_FILE, "utf8").trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.error("[antiraidStore] Read error:", err);
    return {};
  }
}

let store: Record<string, AntiRaidConfig> = readStore();

function persist() {
  try {
    ensureDir();
    const tmp = `${ANTIRAID_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
    fs.renameSync(tmp, ANTIRAID_FILE);
  } catch (err) {
    console.error("[antiraidStore] Persist error:", err);
  }
}

export function getDefaultAntiRaidConfig(guildId: string): AntiRaidConfig {
  return {
    guildId,
    enabled: true,
    joinRaid: {
      enabled: true,
      threshold: 5,
      windowSeconds: 10,
      action: "timeout",
      timeoutMinutes: 60,
      autoLockdown: true,
      autoLockdownMinutes: 15,
    },
    accountAgeGate: {
      enabled: true,
      minAgeDays: 3,
      action: "timeout",
      timeoutMinutes: 30,
    },
    antiSpamRaid: {
      enabled: true,
      maxMessages: 5,
      windowSeconds: 3,
      action: "timeout",
      timeoutMinutes: 10,
    },
    antiMentionRaid: {
      enabled: true,
      maxMentions: 4,
      action: "timeout",
      timeoutMinutes: 60,
    },
    whitelistedUsers: [],
    whitelistedRoles: [],
    logChannelId: null,
    activeLockdown: null,
    updatedAt: Date.now(),
  };
}

export function getAntiRaidConfig(guildId: string): AntiRaidConfig {
  if (!store[guildId]) {
    store[guildId] = getDefaultAntiRaidConfig(guildId);
    persist();
  }
  return store[guildId];
}

export function updateAntiRaidConfig(
  guildId: string,
  updater: (prev: AntiRaidConfig) => AntiRaidConfig
): AntiRaidConfig {
  const current = getAntiRaidConfig(guildId);
  const next = updater({ ...current });
  next.updatedAt = Date.now();
  store[guildId] = next;
  persist();
  return next;
}
