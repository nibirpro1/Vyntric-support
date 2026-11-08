import fs from "fs";
import path from "path";

export type MatchMode = "exact" | "contains" | "startswith";

export interface AutoResponse {
  id: string;
  guildId: string;
  trigger: string;
  response: string;
  matchMode: MatchMode;
  useEmbed: boolean;
  createdAt: number;
}

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");
const AR_FILE = path.join(DATA_DIR, "autoresponder.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): Record<string, AutoResponse[]> {
  try {
    ensureDir();
    if (!fs.existsSync(AR_FILE)) return {};
    const raw = fs.readFileSync(AR_FILE, "utf8").trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.error("[autoresponder] Read error:", err);
    return {};
  }
}

let store: Record<string, AutoResponse[]> = readStore();

function persist() {
  try {
    ensureDir();
    const tmp = `${AR_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
    fs.renameSync(tmp, AR_FILE);
  } catch (err) {
    console.error("[autoresponder] Persist error:", err);
  }
}

export function getAutoResponses(guildId: string): AutoResponse[] {
  return store[guildId] || [];
}

export function addAutoResponse(
  guildId: string,
  trigger: string,
  response: string,
  matchMode: MatchMode = "exact",
  useEmbed = false
): AutoResponse {
  if (!store[guildId]) {
    store[guildId] = [];
  }

  // Remove duplicate trigger if exists
  const cleanTrigger = trigger.trim().toLowerCase();
  store[guildId] = store[guildId].filter(
    (item) => item.trigger !== cleanTrigger
  );

  const newItem: AutoResponse = {
    id: `ar_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    guildId,
    trigger: cleanTrigger,
    response,
    matchMode,
    useEmbed,
    createdAt: Date.now(),
  };

  store[guildId].push(newItem);
  persist();
  return newItem;
}

export function removeAutoResponse(guildId: string, triggerOrId: string): boolean {
  if (!store[guildId]) return false;
  const q = triggerOrId.trim().toLowerCase();
  const initLen = store[guildId].length;
  store[guildId] = store[guildId].filter(
    (item) => item.id !== triggerOrId && item.trigger !== q
  );
  if (store[guildId].length !== initLen) {
    persist();
    return true;
  }
  return false;
}

export function clearAutoResponses(guildId: string): void {
  store[guildId] = [];
  persist();
}

export function findMatchingResponse(
  guildId: string,
  text: string
): AutoResponse | null {
  const list = getAutoResponses(guildId);
  if (!list || list.length === 0) return null;

  const content = text.trim().toLowerCase();

  // 1. Try exact matches first
  const exact = list.find(
    (item) => item.matchMode === "exact" && item.trigger === content
  );
  if (exact) return exact;

  // 2. Try startswith
  const start = list.find(
    (item) => item.matchMode === "startswith" && content.startsWith(item.trigger)
  );
  if (start) return start;

  // 3. Try contains
  const contains = list.find(
    (item) => item.matchMode === "contains" && content.includes(item.trigger)
  );
  if (contains) return contains;

  return null;
}
