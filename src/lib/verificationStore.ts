import fs from "fs";
import path from "path";

export interface VerificationConfig {
  guildId: string;
  enabled: boolean;
  channelId: string | null;
  roleId: string | null;           // Role given upon verification
  unverifiedRoleId: string | null; // Role removed upon verification (optional)
  logChannelId: string | null;     // Channel to send verification audit logs (optional)
  waitMinutes: number;             // Minimum wait time (minutes) after joining before member can verify
  bannerUrl: string | null;        // Custom banner image URL or null for default Vyntric banner
  title: string;                   // Embed title
  description: string;             // Embed description
  buttonLabel: string;             // Button label (e.g. "Verify" or "Verify Now")
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
  "Welcome to **{server}**!\n\n" +
  "To gain full access to the server, view all channels, and chat with members, you must verify yourself.\n\n" +
  "📋 **How to verify:**\n" +
  "• Click the **Verify** button below.\n" +
  "• By verifying, you agree to comply with our **Server Rules**, **Discord Terms of Service**, and **Community Guidelines**.\n\n" +
  "⚠️ *Automated security checks are enabled. Any attempt to raid or bypass verification will result in an immediate ban.*";

export function getVerificationConfig(guildId: string): VerificationConfig {
  if (!store[guildId]) {
    store[guildId] = {
      guildId,
      enabled: false,
      channelId: null,
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
