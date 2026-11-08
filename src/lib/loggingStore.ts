import fs from "fs";
import path from "path";

export interface LoggingConfig {
  guildId: string;
  logChannelId: string | null;
  messageDelete: boolean;
  messageUpdate: boolean;
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
      logChannelId: null,
      messageDelete: true,
      messageUpdate: true,
      memberUpdate: true,
      updatedAt: Date.now(),
    };
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
