import fs from "fs";
import path from "path";

export type AntiNukePunishment = "ban" | "kick" | "quarantine";

export interface AntiNukeLimits {
  limit: number;
  windowSeconds: number;
}

export interface AntiNukeFeatures {
  antiBot: {
    enabled: boolean;
    action: "kick_bot_and_punish_inviter" | "kick_bot_only";
  };
  channelDelete: {
    enabled: boolean;
    limit: number;
    windowSeconds: number;
  };
  channelCreate: {
    enabled: boolean;
    limit: number;
    windowSeconds: number;
  };
  roleDelete: {
    enabled: boolean;
    limit: number;
    windowSeconds: number;
  };
  roleCreate: {
    enabled: boolean;
    limit: number;
    windowSeconds: number;
  };
  memberBan: {
    enabled: boolean;
    limit: number;
    windowSeconds: number;
  };
  memberKick: {
    enabled: boolean;
    limit: number;
    windowSeconds: number;
  };
  webhookCreate: {
    enabled: boolean;
    limit: number;
    windowSeconds: number;
  };
  guildUpdate: {
    enabled: boolean;
  };
}

export interface AntiNukeConfig {
  guildId: string;
  enabled: boolean;
  extraOwners: string[];
  whitelistedUsers: string[];
  whitelistedRoles: string[];
  logChannelId: string | null;
  punishment: AntiNukePunishment;
  features: AntiNukeFeatures;
  updatedAt: number;
}

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");
const ANTINUKE_FILE = path.join(DATA_DIR, "antinuke.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): Record<string, AntiNukeConfig> {
  try {
    ensureDir();
    if (!fs.existsSync(ANTINUKE_FILE)) return {};
    const raw = fs.readFileSync(ANTINUKE_FILE, "utf8").trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.error("[antinukeStore] Read error:", err);
    return {};
  }
}

let store: Record<string, AntiNukeConfig> = readStore();

function persist() {
  try {
    ensureDir();
    const tmp = `${ANTINUKE_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
    fs.renameSync(tmp, ANTINUKE_FILE);
  } catch (err) {
    console.error("[antinukeStore] Save error:", err);
  }
}

export function getDefaultAntiNukeFeatures(): AntiNukeFeatures {
  return {
    antiBot: {
      enabled: true,
      action: "kick_bot_and_punish_inviter",
    },
    channelDelete: {
      enabled: true,
      limit: 2,
      windowSeconds: 10,
    },
    channelCreate: {
      enabled: true,
      limit: 3,
      windowSeconds: 10,
    },
    roleDelete: {
      enabled: true,
      limit: 2,
      windowSeconds: 10,
    },
    roleCreate: {
      enabled: true,
      limit: 3,
      windowSeconds: 10,
    },
    memberBan: {
      enabled: true,
      limit: 3,
      windowSeconds: 10,
    },
    memberKick: {
      enabled: true,
      limit: 3,
      windowSeconds: 10,
    },
    webhookCreate: {
      enabled: true,
      limit: 2,
      windowSeconds: 10,
    },
    guildUpdate: {
      enabled: true,
    },
  };
}

export function getAntiNukeConfig(guildId: string): AntiNukeConfig {
  if (!store[guildId]) {
    store[guildId] = {
      guildId,
      enabled: true,
      extraOwners: ["986700106285862973", "1520324366854914054"],
      whitelistedUsers: [],
      whitelistedRoles: [],
      logChannelId: "1508536272048885853", // moderator-only channel in Server Logs
      punishment: "ban",
      features: getDefaultAntiNukeFeatures(),
      updatedAt: Date.now(),
    };
    persist();
  }
  return store[guildId];
}

export function updateAntiNukeConfig(
  guildId: string,
  patch: Partial<Omit<AntiNukeConfig, "guildId">>
): AntiNukeConfig {
  const current = getAntiNukeConfig(guildId);
  store[guildId] = {
    ...current,
    ...patch,
    features: {
      ...current.features,
      ...(patch.features || {}),
    },
    updatedAt: Date.now(),
  };
  persist();
  return store[guildId];
}
