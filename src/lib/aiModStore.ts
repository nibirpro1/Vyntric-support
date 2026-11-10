import fs from "fs";
import path from "path";

export interface AIModConfig {
  guildId: string;
  enabled: boolean;
  timeoutSeconds: number; // default: 40 seconds
  deleteMessage: boolean; // default: true
  warnInChat: boolean;    // default: true
  sendDm: boolean;        // default: true
  logChannelId: string;   // default: 1569792269395955742 (# ai-log)
  exemptRoles: string[];
  exemptUsers: string[];
  exemptChannels: string[];
  customBadWords: string[];
  allowlistWords: string[];
  updatedAt: number;
}

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");
const AIMOD_FILE = path.join(DATA_DIR, "aimod.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): Record<string, AIModConfig> {
  try {
    ensureDir();
    if (!fs.existsSync(AIMOD_FILE)) return {};
    const raw = fs.readFileSync(AIMOD_FILE, "utf8").trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.error("[aimod] Read error:", err);
    return {};
  }
}

let store: Record<string, AIModConfig> = readStore();

function persist() {
  try {
    ensureDir();
    const tmp = `${AIMOD_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
    fs.renameSync(tmp, AIMOD_FILE);
  } catch (err) {
    console.error("[aimod] Persist error:", err);
  }
}

export const DEFAULT_AI_LOG_CHANNEL = "1569792269395955742"; // # ai-log in Server Logs

export function getAIModConfig(guildId: string): AIModConfig {
  if (!store[guildId]) {
    store[guildId] = {
      guildId,
      enabled: true,
      timeoutSeconds: 40,
      deleteMessage: true,
      warnInChat: true,
      sendDm: true,
      logChannelId: DEFAULT_AI_LOG_CHANNEL,
      exemptRoles: [],
      exemptUsers: [
        "986700106285862973",  // mastermafiya1 (Server Owner)
        "1520324366854914054", // insane_nibir_ (Extra Owner)
      ],
      exemptChannels: [
        "1508519539388977163", // command-log
        "1548374744695447623", // messege
        "1508536272048885853", // moderator-only
        DEFAULT_AI_LOG_CHANNEL, // ai-log
      ],
      customBadWords: [],
      allowlistWords: [],
      updatedAt: Date.now(),
    };
    persist();
  }
  return store[guildId];
}

export function updateAIModConfig(
  guildId: string,
  updates: Partial<AIModConfig>
): AIModConfig {
  const current = getAIModConfig(guildId);
  const updated: AIModConfig = {
    ...current,
    ...updates,
    updatedAt: Date.now(),
  };
  store[guildId] = updated;
  persist();
  return updated;
}
