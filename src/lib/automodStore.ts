import fs from "fs";
import path from "path";

export type AutoModPunishment =
  | "warn"
  | "timeout_30s"
  | "timeout_40s"
  | "timeout_1m"
  | "timeout_5m"
  | "timeout_10m";

export interface AutoModConfig {
  guildId: string;
  enabled: boolean;
  antiInvite: boolean;
  antiLink: boolean;
  antiSpam: boolean;
  antiMention: boolean;
  antiBadWords: boolean;
  adminImmunity: boolean;
  badWords: string[];
  allowWords: string[];
  exemptUsers: string[];
  exemptRoles: string[];
  exemptChannels: string[];
  punishment: AutoModPunishment;
  logChannelId: string | null;
  updatedAt: number;
}

export function flattenWords(words: string[]): string[] {
  const result = new Set<string>();
  for (const item of words) {
    const parts = item
      .split(/[\r\n,]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    for (const p of parts) {
      result.add(p);
    }
  }
  return Array.from(result);
}

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");
const AUTOMOD_FILE = path.join(DATA_DIR, "automod.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): Record<string, AutoModConfig> {
  try {
    ensureDir();
    if (!fs.existsSync(AUTOMOD_FILE)) return {};
    const raw = fs.readFileSync(AUTOMOD_FILE, "utf8").trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.error("[automod] Read error:", err);
    return {};
  }
}

let store: Record<string, AutoModConfig> = readStore();

function persist() {
  try {
    ensureDir();
    const tmp = `${AUTOMOD_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
    fs.renameSync(tmp, AUTOMOD_FILE);
  } catch (err) {
    console.error("[automod] Persist error:", err);
  }
}

export function getAutoModConfig(guildId: string): AutoModConfig {
  if (!store[guildId]) {
    store[guildId] = {
      guildId,
      enabled: true,
      antiInvite: true,
      antiLink: false,
      antiSpam: true,
      antiMention: true,
      antiBadWords: true,
      adminImmunity: true,
      badWords: [],
      allowWords: [],
      exemptUsers: [],
      exemptRoles: [],
      exemptChannels: [],
      punishment: "timeout_40s",
      logChannelId: null,
      updatedAt: Date.now(),
    };
  }

  const cfg = store[guildId];
  // Backfill newly added fields cleanly for existing stored configs
  if (cfg.badWords) cfg.badWords = flattenWords(cfg.badWords);
  else cfg.badWords = [];

  if (cfg.allowWords) cfg.allowWords = flattenWords(cfg.allowWords);
  else cfg.allowWords = [];

  if (cfg.antiBadWords === undefined) cfg.antiBadWords = true;
  if (cfg.adminImmunity === undefined) cfg.adminImmunity = true;
  if (!Array.isArray(cfg.exemptUsers)) cfg.exemptUsers = [];
  if (!Array.isArray(cfg.exemptRoles)) cfg.exemptRoles = [];
  if (!Array.isArray(cfg.exemptChannels)) cfg.exemptChannels = [];

  return cfg;
}

export function updateAutoModConfig(
  guildId: string,
  updates: Partial<AutoModConfig>
): AutoModConfig {
  const current = getAutoModConfig(guildId);
  const badWords = updates.badWords ? flattenWords(updates.badWords) : current.badWords;
  const allowWords = updates.allowWords ? flattenWords(updates.allowWords) : current.allowWords;

  const updated: AutoModConfig = {
    ...current,
    ...updates,
    badWords,
    allowWords,
    updatedAt: Date.now(),
  };
  store[guildId] = updated;
  persist();
  return updated;
}
