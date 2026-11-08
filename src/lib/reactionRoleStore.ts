import fs from "fs";
import path from "path";

export interface RoleOption {
  roleId: string;
  label: string;
  emoji?: string;
  style?: "primary" | "secondary" | "success" | "danger";
}

export interface ReactionRolePanel {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  title: string;
  description: string;
  roles: RoleOption[];
  createdAt: number;
}

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");
const RR_FILE = path.join(DATA_DIR, "reaction_roles.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): Record<string, ReactionRolePanel[]> {
  try {
    ensureDir();
    if (!fs.existsSync(RR_FILE)) return {};
    const raw = fs.readFileSync(RR_FILE, "utf8").trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.error("[reactionRoleStore] Read error:", err);
    return {};
  }
}

let store: Record<string, ReactionRolePanel[]> = readStore();

function persist() {
  try {
    ensureDir();
    const tmp = `${RR_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
    fs.renameSync(tmp, RR_FILE);
  } catch (err) {
    console.error("[reactionRoleStore] Persist error:", err);
  }
}

export function getPanels(guildId: string): ReactionRolePanel[] {
  return store[guildId] || [];
}

export function savePanel(panel: ReactionRolePanel): void {
  if (!store[panel.guildId]) {
    store[panel.guildId] = [];
  }
  const idx = store[panel.guildId].findIndex((p) => p.messageId === panel.messageId);
  if (idx >= 0) {
    store[panel.guildId][idx] = panel;
  } else {
    store[panel.guildId].push(panel);
  }
  persist();
}

export function findPanel(guildId: string, messageId: string): ReactionRolePanel | undefined {
  return (store[guildId] || []).find((p) => p.messageId === messageId);
}
