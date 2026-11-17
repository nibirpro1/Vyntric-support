import fs from "fs";
import path from "path";

export interface Vc247Config {
  guildId: string;
  enabled: boolean;
  channelId: string | null;
  deafened: boolean;
  autoReconnect: boolean;
  connectedAt: number | null;
  reconnectCount: number;
  updatedAt: number;
}

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");
const VC_247_FILE = path.join(DATA_DIR, "vc247.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): Record<string, Vc247Config> {
  try {
    ensureDir();
    if (!fs.existsSync(VC_247_FILE)) return {};
    const raw = fs.readFileSync(VC_247_FILE, "utf8").trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.error("[vc247Store] Read error:", err);
    return {};
  }
}

let store: Record<string, Vc247Config> = readStore();

function persist() {
  try {
    ensureDir();
    const tmp = `${VC_247_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
    fs.renameSync(tmp, VC_247_FILE);
  } catch (err) {
    console.error("[vc247Store] Persist error:", err);
  }
}

export function getDefaultVc247Config(guildId: string): Vc247Config {
  return {
    guildId,
    enabled: false,
    channelId: null,
    deafened: true,
    autoReconnect: true,
    connectedAt: null,
    reconnectCount: 0,
    updatedAt: Date.now(),
  };
}

export function getVc247Config(guildId: string): Vc247Config {
  if (!store[guildId]) {
    store[guildId] = getDefaultVc247Config(guildId);
    persist();
  }
  return store[guildId];
}

export function getAllVc247Configs(): Record<string, Vc247Config> {
  return store;
}

export function updateVc247Config(
  guildId: string,
  updater: (prev: Vc247Config) => Vc247Config
): Vc247Config {
  const current = getVc247Config(guildId);
  const next = updater({ ...current });
  next.updatedAt = Date.now();
  store[guildId] = next;
  persist();
  return next;
}
