import fs from "fs";
import path from "path";

export type AutoModPunishment = "warn" | "timeout_1m" | "timeout_5m" | "timeout_10m";

export interface AutoModConfig {
  guildId: string;
  enabled: boolean;
  antiInvite: boolean;
  antiLink: boolean;
  antiSpam: boolean;
  antiMention: boolean;
  adminImmunity: boolean;
  badWords: string[];
  punishment: AutoModPunishment;
  logChannelId: string | null;
  updatedAt: number;
}

export function flattenWords(words: string[]): string[] {
  const result = new Set<string>();
  for (const item of words) {
    const parts = item.split(/[\r\n,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
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
      adminImmunity: false,
      badWords: [],
      punishment: "warn",
      logChannelId: null,
      updatedAt: Date.now(),
    };
  }
  // Ensure badWords is flattened
  if (store[guildId].badWords) {
    store[guildId].badWords = flattenWords(store[guildId].badWords);
  }
  if (store[guildId].adminImmunity === undefined) {
    store[guildId].adminImmunity = false;
  }
  return store[guildId];
}

export function updateAutoModConfig(
  guildId: string,
  updates: Partial<AutoModConfig>
): AutoModConfig {
  const current = getAutoModConfig(guildId);
  const badWords = updates.badWords ? flattenWords(updates.badWords) : current.badWords;
  const updated: AutoModConfig = {
    ...current,
    ...updates,
    badWords,
    updatedAt: Date.now(),
  };
  store[guildId] = updated;
  persist();
  return updated;
}
