import fs from "fs";
import path from "path";

export interface BoosterConfig {
  guildId: string;
  enabled: boolean;
  roleId: string | null;           // Role given to active boosters
  channelId: string | null;        // Channel where celebratory boost messages are announced
  message: string;                 // Embed description template
  dmEnabled: boolean;              // Whether to send thank-you DM
  dmMessage: string;               // Thank-you DM template
  updatedAt: number;
}

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");
const BOOSTER_FILE = path.join(DATA_DIR, "booster.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): Record<string, BoosterConfig> {
  try {
    ensureDir();
    if (!fs.existsSync(BOOSTER_FILE)) return {};
    const raw = fs.readFileSync(BOOSTER_FILE, "utf8").trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.error("[boosterStore] Read error:", err);
    return {};
  }
}

let store: Record<string, BoosterConfig> = readStore();

function persist() {
  try {
    ensureDir();
    const tmp = `${BOOSTER_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
    fs.renameSync(tmp, BOOSTER_FILE);
  } catch (err) {
    console.error("[boosterStore] Save error:", err);
  }
}

export const DEFAULT_BOOSTER_ROLE_ID = "1509501020399599726"; // Server Booster role

export const DEFAULT_BOOSTER_MSG =
  "🎉 **THANK YOU FOR BOOSTING!**\n\n" +
  "Huge shoutout to {user} for boosting **{server}**!\n" +
  "We have now reached **{boostCount} Boosts** (Tier {level})! 🚀\n\n" +
  "Your support means the world to our community. Enjoy your exclusive booster perks and role!";

export const DEFAULT_BOOSTER_DM =
  "Thank you so much for boosting **{server}**, {username}! 💖\n" +
  "Your boost helps upgrade our audio quality, server banner, and member perks. " +
  "You've been granted your special booster role!";

export function formatBoosterText(
  template: string,
  data: {
    user: string;
    username: string;
    server: string;
    boostCount: number;
    level: number;
  }
): string {
  return template
    .replace(/{user}/g, data.user)
    .replace(/{username}/g, data.username)
    .replace(/{server}/g, data.server)
    .replace(/{boostCount}/g, String(data.boostCount))
    .replace(/{level}/g, String(data.level));
}

export function getBoosterConfig(guildId: string): BoosterConfig {
  if (!store[guildId]) {
    store[guildId] = {
      guildId,
      enabled: true,
      roleId: DEFAULT_BOOSTER_ROLE_ID,
      channelId: null,
      message: DEFAULT_BOOSTER_MSG,
      dmEnabled: true,
      dmMessage: DEFAULT_BOOSTER_DM,
      updatedAt: Date.now(),
    };
  }
  return store[guildId];
}

export function updateBoosterConfig(
  guildId: string,
  patch: Partial<Omit<BoosterConfig, "guildId" | "updatedAt">>
): BoosterConfig {
  const current = getBoosterConfig(guildId);
  store[guildId] = {
    ...current,
    ...patch,
    updatedAt: Date.now(),
  };
  persist();
  return store[guildId];
}
