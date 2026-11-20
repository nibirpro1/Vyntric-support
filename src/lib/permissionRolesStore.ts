import fs from "fs";
import path from "path";
import { Guild, GuildMember, PermissionFlagsBits, Role } from "discord.js";
import { isUniversalImmune } from "./universalWhitelist";

export type FeaturePermission =
  | "link"
  | "media"
  | "announce_server"
  | "announce_uhc"
  | "announce_smp"
  | "announce"
  | "giveaway"
  | "vcmod"
  | "move"
  | "mention"
  | "automod_bypass"
  | "mod"
  | "ticket"
  | "security";

export interface PermissionRoleDef {
  key: FeaturePermission;
  name: string;
  defaultId: string;
  emoji: string;
  color: number;
  description: string;
}

export const PERMISSION_ROLE_DEFS: PermissionRoleDef[] = [
  {
    key: "link",
    name: "🔗 Link Perms",
    defaultId: "1571254489610977400",
    emoji: "🔗",
    color: 0x3498db,
    description: "Post external links & Discord invites freely without AutoMod block",
  },
  {
    key: "media",
    name: "🖼️ Media Perms",
    defaultId: "1571258778081558548",
    emoji: "🖼️",
    color: 0x1abc9c,
    description: "Post images, attachments, files, videos & media",
  },
  {
    key: "announce_server",
    name: "📢 Server Announce",
    defaultId: "1571405116869840926",
    emoji: "📢",
    color: 0xf39c12,
    description: "Publish official server announcements in #announcement (/announcement)",
  },
  {
    key: "announce_uhc",
    name: "⚔️ UHC Announce",
    defaultId: "1571405118786633798",
    emoji: "⚔️",
    color: 0xe74c3c,
    description: "Publish announcements and events in UHC channels (/announcement)",
  },
  {
    key: "announce_smp",
    name: "⛏️ SMP Announce",
    defaultId: "1572502172992798730",
    emoji: "⛏️",
    color: 0x2ecc71,
    description: "Publish announcements, rules & votes in SMP channels",
  },
  {
    key: "giveaway",
    name: "🎁 Giveaway Perms",
    defaultId: "1571258781487210660",
    emoji: "🎁",
    color: 0x9b59b6,
    description: "Host, manage, and end giveaways (/giveaway)",
  },
  {
    key: "vcmod",
    name: "🎙️ VC Mod Perms",
    defaultId: "1571258783471243304",
    emoji: "🎙️",
    color: 0xe67e22,
    description: "Moderate Voice Channels (/vc kick, /vc mute, /vc timeout, /vc move)",
  },
  {
    key: "move",
    name: "🔀 Move Perms",
    defaultId: "1572249183832768662",
    emoji: "🔀",
    color: 0x3498db,
    description: "Move members between Voice Channels (/vc move, /vc moveall)",
  },
  {
    key: "mention",
    name: "🔔 Mention Perms",
    defaultId: "1571258785589239878",
    emoji: "🔔",
    color: 0xe91e63,
    description: "Ping multiple roles or members without AutoMod mass-mention strikes",
  },
  {
    key: "automod_bypass",
    name: "🛡️ AutoMod Bypass",
    defaultId: "1571258787778535536",
    emoji: "🛡️",
    color: 0x2ecc71,
    description: "Complete whitelist exemption: bypass all AutoMod filters, links, invites, profanity, and rate limits",
  },
  {
    key: "mod",
    name: "⚖️ Warn & Mod Perms",
    defaultId: "1571509403918532618",
    emoji: "⚖️",
    color: 0xe67e22,
    description: "Issue warnings (/warn, warn @user) and timeouts (mute @user, /timeout)",
  },
  {
    key: "ticket",
    name: "🎫 Ticket Staff Perms",
    defaultId: "1571509405915291740",
    emoji: "🎫",
    color: 0x9b59b6,
    description: "Manage, claim, close, and handle tickets in the support system",
  },
  {
    key: "security",
    name: "🔐 Security Perms",
    defaultId: "1571509407865638993",
    emoji: "🔐",
    color: 0xe74c3c,
    description: "Manage Anti-Nuke, Anti-Raid, and server protection settings",
  },
];

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");
const PERMS_FILE = path.join(DATA_DIR, "permission_roles.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): Record<string, Record<string, string>> {
  try {
    ensureDir();
    if (!fs.existsSync(PERMS_FILE)) return {};
    const raw = fs.readFileSync(PERMS_FILE, "utf8").trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

let store: Record<string, Record<string, string>> = readStore();

function persist() {
  try {
    ensureDir();
    const tmp = `${PERMS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
    fs.renameSync(tmp, PERMS_FILE);
  } catch (err) {
    console.error("[permissionRoles] Persist error:", err);
  }
}

export function getGuildPermissionRoles(guildId: string): Record<string, string> {
  if (!store[guildId]) {
    store[guildId] = {};
  }
  let modified = false;
  for (const def of PERMISSION_ROLE_DEFS) {
    if (!store[guildId][def.key]) {
      store[guildId][def.key] = def.defaultId;
      modified = true;
    }
  }
  if (!store[guildId]["announce"]) {
    store[guildId]["announce"] = "1571405116869840926";
    modified = true;
  }
  if (modified) {
    persist();
  }
  return store[guildId];
}

export function setGuildPermissionRole(
  guildId: string,
  feature: FeaturePermission,
  roleId: string
): void {
  const current = getGuildPermissionRoles(guildId);
  current[feature] = roleId;
  if (feature === "announce_server") {
    current["announce"] = roleId;
  }
  store[guildId] = current;
  persist();
}

/**
 * Resolves a role for a feature in a guild:
 * 1. By stored role ID
 * 2. By known default ID
 * 3. By matching role name
 * 4. Or creates it if missing
 */
export async function resolveFeatureRole(
  guild: Guild,
  feature: FeaturePermission
): Promise<Role | null> {
  const effectiveKey = feature === "announce" ? "announce_server" : feature;
  const def = PERMISSION_ROLE_DEFS.find((d) => d.key === effectiveKey);
  if (!def) return null;

  const currentMap = getGuildPermissionRoles(guild.id);
  const targetId = currentMap[effectiveKey] || currentMap[feature] || def.defaultId;

  if (targetId) {
    const existing = guild.roles.cache.get(targetId);
    if (existing) return existing;
  }

  // Look by name
  const byName = guild.roles.cache.find(
    (r) =>
      r.name.toLowerCase() === def.name.toLowerCase() ||
      r.name.toLowerCase().includes(def.name.toLowerCase().replace(/[^a-z]/g, ""))
  );
  if (byName) {
    setGuildPermissionRole(guild.id, feature, byName.id);
    return byName;
  }

  // Create role
  try {
    const created = await guild.roles.create({
      name: def.name,
      color: def.color,
      permissions: feature === "move" ? [PermissionFlagsBits.MoveMembers] : undefined,
      reason: `Auto-created feature permission role for ${def.name}`,
    });
    setGuildPermissionRole(guild.id, feature, created.id);
    return created;
  } catch (err) {
    console.error(`[resolveFeatureRole:create:${feature}]`, err);
    return null;
  }
}

/**
 * Checks if a member has permission for a specific feature:
 * - Server Owner always has permission
 * - Server Administrators always have permission
 * - Or member holds the dedicated feature role
 */
export function hasFeaturePermission(member: GuildMember, feature: FeaturePermission): boolean {
  if (member.id === member.guild.ownerId) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (isUniversalImmune(member.guild, member.id, member)) return true;
  if (feature === "move" && member.permissions.has(PermissionFlagsBits.MoveMembers)) return true;

  const currentMap = getGuildPermissionRoles(member.guild.id);
  const effectiveKey = feature === "announce" ? "announce_server" : feature;
  const targetId = currentMap[effectiveKey] || currentMap[feature];

  if (targetId && member.roles.cache.has(targetId)) return true;

  const def = PERMISSION_ROLE_DEFS.find((d) => d.key === effectiveKey);
  if (def && member.roles.cache.has(def.defaultId)) return true;

  // Fallback match by role name
  if (def) {
    const role = member.roles.cache.find(
      (r) =>
        r.name.toLowerCase() === def.name.toLowerCase() ||
        (feature === "move" && r.name.toLowerCase() === "move")
    );
    if (role) return true;
  }

  return false;
}

