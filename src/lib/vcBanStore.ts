import fs from "fs";
import path from "path";

export interface VcBanRecord {
  guildId: string;
  userId: string;
  userTag: string;
  staffId: string;
  staffTag: string;
  reason: string;
  timestamp: number;
}

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");
const VC_BANS_FILE = path.join(DATA_DIR, "vc_bans.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): Record<string, VcBanRecord[]> {
  try {
    ensureDir();
    if (!fs.existsSync(VC_BANS_FILE)) return {};
    const raw = fs.readFileSync(VC_BANS_FILE, "utf8").trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

let store: Record<string, VcBanRecord[]> = readStore();

function persist() {
  try {
    ensureDir();
    const tmp = `${VC_BANS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
    fs.renameSync(tmp, VC_BANS_FILE);
  } catch (err) {
    console.error("[vcBanStore] Persist error:", err);
  }
}

export function isUserVcBanned(guildId: string, userId: string): boolean {
  const bans = store[guildId] || [];
  return bans.some((b) => b.userId === userId);
}

export function getVcBan(guildId: string, userId: string): VcBanRecord | undefined {
  const bans = store[guildId] || [];
  return bans.find((b) => b.userId === userId);
}

export function addVcBan(record: VcBanRecord): void {
  const bans = store[record.guildId] || [];
  const existingIndex = bans.findIndex((b) => b.userId === record.userId);
  if (existingIndex >= 0) {
    bans[existingIndex] = record;
  } else {
    bans.push(record);
  }
  store[record.guildId] = bans;
  persist();
}

export function removeVcBan(guildId: string, userId: string): boolean {
  const bans = store[guildId] || [];
  const filtered = bans.filter((b) => b.userId !== userId);
  if (filtered.length !== bans.length) {
    store[guildId] = filtered;
    persist();
    return true;
  }
  return false;
}

export function getGuildVcBans(guildId: string): VcBanRecord[] {
  return store[guildId] || [];
}
