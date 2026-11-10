import fs from "fs";
import path from "path";

export interface VerificationConfig {
  guildId: string;
  enabled: boolean;
  channelId: string | null;
  messageId: string | null;           // Active panel message ID
  mode: "reaction" | "button" | "both"; // Defaults to "reaction"
  reactionEmoji: string;               // Emoji to react with, defaults to "✅"
  roleId: string | null;               // Role given upon verification
  unverifiedRoleId: string | null;     // Role removed upon verification (optional)
  logChannelId: string | null;         // Channel to send verification audit logs (optional)
  waitMinutes: number;                 // Minimum wait time (minutes) after joining before member can verify
  bannerUrl: string | null;            // Custom banner image URL or null for default Vyntric banner
  title: string;                       // Embed title
  description: string;                 // Embed description
  buttonLabel: string;                 // Button label (if button mode used)
  updatedAt: number;
}

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");
const VERIFICATION_FILE = path.join(DATA_DIR, "verification.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): Record<string, VerificationConfig> {
  try {
    ensureDir();
    if (!fs.existsSync(VERIFICATION_FILE)) return {};
    const raw = fs.readFileSync(VERIFICATION_FILE, "utf8").trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.error("[verificationStore] Read error:", err);
    return {};
  }
}

let store: Record<string, VerificationConfig> = readStore();

function persist() {
  try {
    ensureDir();
    const tmp = `${VERIFICATION_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
    fs.renameSync(tmp, VERIFICATION_FILE);
  } catch (err) {
    console.error("[verificationStore] Save error:", err);
  }
}

export const DEFAULT_VERIFICATION_TITLE = "🔐 SERVER VERIFICATION";

export const DEFAULT_VERIFICATION_DESC =
  "Welcome to **{server}**!\n" +
  "React with the **✅** emoji below to verify and unlock full access.";

export function getVerificationConfig(guildId: string): VerificationConfig {
  if (!store[guildId]) {
    store[guildId] = {
      guildId,
      enabled: false,
      channelId: null,
      messageId: null,
      mode: "reaction",
      reactionEmoji: "✅",
      roleId: null,
      unverifiedRoleId: null,
      logChannelId: null,
      waitMinutes: 0,
      bannerUrl: null,
      title: DEFAULT_VERIFICATION_TITLE,
      description: DEFAULT_VERIFICATION_DESC,
      buttonLabel: "Verify",
      updatedAt: Date.now(),
    };
  }
  // Ensure default new properties if config exists
  if (!store[guildId].mode) store[guildId].mode = "reaction";
  if (!store[guildId].reactionEmoji) store[guildId].reactionEmoji = "✅";
  if (store[guildId].messageId === undefined) store[guildId].messageId = null;

  return store[guildId];
}

export function updateVerificationConfig(
  guildId: string,
  patch: Partial<Omit<VerificationConfig, "guildId" | "updatedAt">>
): VerificationConfig {
  const current = getVerificationConfig(guildId);
  store[guildId] = {
    ...current,
    ...patch,
    updatedAt: Date.now(),
  };
  persist();
  return store[guildId];
}
