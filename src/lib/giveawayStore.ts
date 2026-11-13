import fs from "fs";
import path from "path";

export interface Giveaway {
  id: string; // Message ID
  guildId: string;
  channelId: string;
  messageId: string;
  prize: string;
  winnersCount: number;
  hostId: string;
  requiredRoleId: string | null;
  partnerInviteUrl?: string | null;
  partnerGuildId?: string | null;
  partnerGuildName?: string | null;
  secretWinnerIds: string[]; // Predetermined / rigged winners
  entries: string[]; // User IDs who joined
  startTime: number;
  endTime: number;
  ended: boolean;
  winnerIds: string[];
}

export interface GiveawayGuildSettings {
  guildId: string;
  managerRoleIds: string[]; // Roles allowed to host giveaways (e.g. Partnership)
  updatedAt: number;
}

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");
const GIVEAWAYS_FILE = path.join(DATA_DIR, "giveaways.json");
const SETTINGS_FILE = path.join(DATA_DIR, "giveaway_settings.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readSettingsStore(): Record<string, GiveawayGuildSettings> {
  try {
    ensureDir();
    if (!fs.existsSync(SETTINGS_FILE)) return {};
    const raw = fs.readFileSync(SETTINGS_FILE, "utf8").trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.error("[giveawaySettings] Read error:", err);
    return {};
  }
}

let settingsStore: Record<string, GiveawayGuildSettings> = readSettingsStore();

function persistSettings() {
  try {
    ensureDir();
    const tmp = `${SETTINGS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(settingsStore, null, 2), "utf8");
    fs.renameSync(tmp, SETTINGS_FILE);
  } catch (err) {
    console.error("[giveawaySettings] Persist error:", err);
  }
}

export function getGiveawayGuildSettings(guildId: string): GiveawayGuildSettings {
  if (!settingsStore[guildId]) {
    settingsStore[guildId] = {
      guildId,
      managerRoleIds: [],
      updatedAt: Date.now(),
    };
    persistSettings();
  }
  return settingsStore[guildId];
}

export function addGiveawayManagerRole(guildId: string, roleId: string): GiveawayGuildSettings {
  const current = getGiveawayGuildSettings(guildId);
  if (!current.managerRoleIds.includes(roleId)) {
    current.managerRoleIds.push(roleId);
    current.updatedAt = Date.now();
    persistSettings();
  }
  return current;
}

export function removeGiveawayManagerRole(guildId: string, roleId: string): GiveawayGuildSettings {
  const current = getGiveawayGuildSettings(guildId);
  current.managerRoleIds = current.managerRoleIds.filter((id) => id !== roleId);
  current.updatedAt = Date.now();
  persistSettings();
  return current;
}

function readStore(): Record<string, Giveaway> {
  try {
    ensureDir();
    if (!fs.existsSync(GIVEAWAYS_FILE)) return {};
    const raw = fs.readFileSync(GIVEAWAYS_FILE, "utf8").trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.error("[giveaways] Read error:", err);
    return {};
  }
}

let store: Record<string, Giveaway> = readStore();

function persist() {
  try {
    ensureDir();
    const tmp = `${GIVEAWAYS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
    fs.renameSync(tmp, GIVEAWAYS_FILE);
  } catch (err) {
    console.error("[giveaways] Persist error:", err);
  }
}

export function getAllGiveaways(guildId?: string): Giveaway[] {
  const all = Object.values(store);
  if (guildId) {
    return all.filter((g) => g.guildId === guildId);
  }
  return all;
}

export function getActiveGiveaways(guildId?: string): Giveaway[] {
  return getAllGiveaways(guildId).filter((g) => !g.ended);
}

export function getGiveaway(messageId: string): Giveaway | undefined {
  return store[messageId];
}

export function saveGiveaway(giveaway: Giveaway): void {
  store[giveaway.messageId] = giveaway;
  persist();
}

export function deleteGiveaway(messageId: string): boolean {
  if (store[messageId]) {
    delete store[messageId];
    persist();
    return true;
  }
  return false;
}

export function setSecretWinner(messageId: string, userId: string): boolean {
  const g = store[messageId];
  if (!g) return false;
  if (!g.secretWinnerIds) g.secretWinnerIds = [];
  if (!g.secretWinnerIds.includes(userId)) {
    g.secretWinnerIds.push(userId);
  }
  // Also ensure they are in entries so it appears 100% natural
  if (!g.entries.includes(userId)) {
    g.entries.push(userId);
  }
  persist();
  return true;
}

export function clearSecretWinners(messageId: string): boolean {
  const g = store[messageId];
  if (!g) return false;
  g.secretWinnerIds = [];
  persist();
  return true;
}

export function toggleGiveawayEntry(
  messageId: string,
  userId: string
): { entered: boolean; entriesCount: number } | null {
  const g = store[messageId];
  if (!g || g.ended) return null;

  const idx = g.entries.indexOf(userId);
  let entered = false;
  if (idx >= 0) {
    // Leave
    g.entries.splice(idx, 1);
    entered = false;
  } else {
    // Join
    g.entries.push(userId);
    entered = true;
  }
  persist();
  return { entered, entriesCount: g.entries.length };
}
