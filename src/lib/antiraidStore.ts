import fs from "fs";
import path from "path";

export type AntiRaidAction = "timeout" | "quarantine" | "kick";
export type LockdownMode = "soft" | "hard";

export interface RaiderProfile {
  userId: string;
  userTag: string;
  createdAt: number;
  joinedAt: number;
  riskScore: number;
  riskFactors: string[];
  timedOut: boolean;
  inviteCode?: string;
}

export interface RaidIncident {
  id: string;
  timestamp: number;
  type: "mass_join" | "name_pattern" | "default_avatar" | "cross_channel_spam" | "risk_spike" | "manual_panic";
  velocity: string;
  inviteCode?: string;
  raiderCount: number;
  raiders: RaiderProfile[];
  lockdownApplied: boolean;
  channelsLocked: string[];
}

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
    lockdownMode: LockdownMode; // soft vs hard
  };
  riskScoring: {
    enabled: boolean;
    quarantineThreshold: number; // default: 60 (out of 100)
    alertThreshold: number; // default: 45
    action: "timeout" | "quarantine" | "alert";
    timeoutMinutes: number; // default: 60
  };
  nameSimilarity: {
    enabled: boolean;
    threshold: number; // e.g. 3 similar names in window
    similarityRatio: number; // e.g. 0.75
  };
  defaultAvatarGate: {
    enabled: boolean;
    burstCount: number; // e.g. 3 default avatars in 15s triggers wave alarm
  };
  inviteTracking: {
    enabled: boolean;
    autoRevokeRaidInvite: boolean; // auto-delete invite used by raiders
  };
  crossChannelSpam: {
    enabled: boolean;
    maxChannels: number; // default: 2 channels within 10s
    timeoutMinutes: number; // default: 60
  };
  accountAgeGate: {
    enabled: boolean;
    minAgeDays: number; // default: 3 days
    action: "timeout" | "quarantine" | "kick" | "alert";
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
    maxMentions: number; // default: 4 mentions
    action: "timeout";
    timeoutMinutes: number; // default: 60 minutes
  };
  whitelistedUsers: string[];
  whitelistedRoles: string[];
  logChannelId: string | null;
  activeLockdown: {
    active: boolean;
    mode: LockdownMode;
    startedAt: number;
    channelsLocked: string[];
    expiresAt?: number;
    reason?: string;
    initiatedBy?: string;
  } | null;
  lastIncident: RaidIncident | null;
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
      lockdownMode: "hard",
    },
    riskScoring: {
      enabled: true,
      quarantineThreshold: 60,
      alertThreshold: 45,
      action: "timeout",
      timeoutMinutes: 60,
    },
    nameSimilarity: {
      enabled: true,
      threshold: 3,
      similarityRatio: 0.75,
    },
    defaultAvatarGate: {
      enabled: true,
      burstCount: 3,
    },
    inviteTracking: {
      enabled: true,
      autoRevokeRaidInvite: true,
    },
    crossChannelSpam: {
      enabled: true,
      maxChannels: 2,
      timeoutMinutes: 60,
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
    lastIncident: null,
    updatedAt: Date.now(),
  };
}

export function getAntiRaidConfig(guildId: string): AntiRaidConfig {
  if (!store[guildId]) {
    store[guildId] = getDefaultAntiRaidConfig(guildId);
    persist();
  } else {
    // Migration: ensure new fields are populated
    const current = store[guildId];
    let changed = false;
    const defaults = getDefaultAntiRaidConfig(guildId);
    if (!current.riskScoring) {
      current.riskScoring = defaults.riskScoring;
      changed = true;
    }
    if (!current.nameSimilarity) {
      current.nameSimilarity = defaults.nameSimilarity;
      changed = true;
    }
    if (!current.defaultAvatarGate) {
      current.defaultAvatarGate = defaults.defaultAvatarGate;
      changed = true;
    }
    if (!current.inviteTracking) {
      current.inviteTracking = defaults.inviteTracking;
      changed = true;
    }
    if (!current.crossChannelSpam) {
      current.crossChannelSpam = defaults.crossChannelSpam;
      changed = true;
    }
    if (changed) persist();
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
