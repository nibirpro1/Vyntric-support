import { Guild, GuildMember, PermissionFlagsBits } from "discord.js";
import { getAntiNukeConfig, updateAntiNukeConfig } from "./antinukeStore";
import { getAntiRaidConfig, updateAntiRaidConfig } from "./antiraidStore";
import { getAutoModConfig, updateAutoModConfig } from "./automodStore";

export const PERMANENT_IMMUNE_USER_IDS = new Set<string>([
  "1495738572362481777", // notraian69. (Designated Protected Co-Owner / Full Admin)
]);

export const AUTOMOD_BYPASS_ROLE_ID = "1571258787778535536";

/**
 * Synchronous Universal Immunity evaluator.
 * Determines if a user or role member has universal immunity across all bot systems:
 * AntiNuke, AntiRaid, AutoMod, Moderation protection, and Feature permissions.
 */
export function isUniversalImmune(
  guild: Guild,
  userId: string,
  member?: GuildMember | null
): boolean {
  if (!userId) return false;

  // 1. Bot itself is immune
  if (guild.client.user && userId === guild.client.user.id) return true;

  // 2. Server Owner is always universally immune
  if (guild.ownerId === userId) return true;

  // 3. Designated Protected Co-Owner / Super Admins
  if (PERMANENT_IMMUNE_USER_IDS.has(userId)) return true;

  // 4. Anti-Nuke configurations
  const nukeConfig = getAntiNukeConfig(guild.id);
  if (nukeConfig.extraOwners?.includes(userId)) return true;
  if (nukeConfig.whitelistedUsers?.includes(userId)) return true;

  // 5. Anti-Raid configurations
  const raidConfig = getAntiRaidConfig(guild.id);
  if (raidConfig.whitelistedUsers?.includes(userId)) return true;

  // 6. AutoMod configurations
  const autoModConfig = getAutoModConfig(guild.id);
  if (autoModConfig.exemptUsers?.includes(userId)) return true;

  // 7. Member-based role & permission checks
  const targetMember = member || guild.members.cache.get(userId);
  if (targetMember) {
    // Administrator or ManageGuild permissions grant universal immunity
    if (
      targetMember.permissions.has(PermissionFlagsBits.Administrator) ||
      targetMember.permissions.has(PermissionFlagsBits.ManageGuild)
    ) {
      return true;
    }

    // Anti-Nuke whitelisted roles
    if (
      nukeConfig.whitelistedRoles &&
      nukeConfig.whitelistedRoles.some((rId) => targetMember.roles.cache.has(rId))
    ) {
      return true;
    }

    // Anti-Raid whitelisted roles
    if (
      raidConfig.whitelistedRoles &&
      raidConfig.whitelistedRoles.some((rId) => targetMember.roles.cache.has(rId))
    ) {
      return true;
    }

    // AutoMod exempt roles or dedicated AutoMod Bypass role
    const hasRoleNameBypass =
      targetMember.roles.cache &&
      Array.from(targetMember.roles.cache.values()).some(
        (r: any) => r && typeof r.name === "string" && r.name.toLowerCase() === "automod bypass"
      );

    if (
      targetMember.roles.cache.has(AUTOMOD_BYPASS_ROLE_ID) ||
      (autoModConfig.exemptRoles &&
        autoModConfig.exemptRoles.some((rId) => targetMember.roles.cache.has(rId))) ||
      hasRoleNameBypass
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Asynchronous Universal Immunity evaluator.
 * Safely fetches the member from Discord API if not present in memory cache
 * to prevent race conditions during join events or cold cache lookups.
 */
export async function isUniversalImmuneAsync(
  guild: Guild,
  userId: string,
  member?: GuildMember | null
): Promise<boolean> {
  if (!userId) return false;

  // Fast-path synchronous checks (Owner, ExtraOwners, Whitelisted Users)
  if (isUniversalImmune(guild, userId, member)) return true;

  // If member wasn't available in cache, fetch and evaluate roles
  let targetMember: GuildMember | null | undefined = member || guild.members.cache.get(userId);
  if (!targetMember) {
    targetMember = await guild.members.fetch(userId).catch(() => null);
  }

  if (targetMember) {
    return isUniversalImmune(guild, userId, targetMember);
  }

  return false;
}

/**
 * 3-Way Atomic Synchronization: Add target user or role to AntiNuke, AntiRaid, and AutoMod.
 */
export function syncWhitelistAdd(
  guildId: string,
  options: { userId?: string; roleId?: string }
): void {
  const { userId, roleId } = options;

  // 1. Sync Anti-Nuke
  const nuke = getAntiNukeConfig(guildId);
  const nukeUsers = new Set(nuke.whitelistedUsers || []);
  const nukeRoles = new Set(nuke.whitelistedRoles || []);
  if (userId) nukeUsers.add(userId);
  if (roleId) nukeRoles.add(roleId);
  updateAntiNukeConfig(guildId, {
    whitelistedUsers: Array.from(nukeUsers),
    whitelistedRoles: Array.from(nukeRoles),
  });

  // 2. Sync Anti-Raid
  const raid = getAntiRaidConfig(guildId);
  const raidUsers = new Set(raid.whitelistedUsers || []);
  const raidRoles = new Set(raid.whitelistedRoles || []);
  if (userId) raidUsers.add(userId);
  if (roleId) raidRoles.add(roleId);
  updateAntiRaidConfig(guildId, (prev) => ({
    ...prev,
    whitelistedUsers: Array.from(raidUsers),
    whitelistedRoles: Array.from(raidRoles),
  }));

  // 3. Sync AutoMod (exemptUsers & exemptRoles)
  const am = getAutoModConfig(guildId);
  const amUsers = new Set(am.exemptUsers || []);
  const amRoles = new Set(am.exemptRoles || []);
  if (userId) amUsers.add(userId);
  if (roleId) amRoles.add(roleId);
  updateAutoModConfig(guildId, {
    exemptUsers: Array.from(amUsers),
    exemptRoles: Array.from(amRoles),
  });
}

/**
 * 3-Way Atomic Synchronization: Remove target user or role from AntiNuke, AntiRaid, and AutoMod.
 */
export function syncWhitelistRemove(
  guildId: string,
  options: { userId?: string; roleId?: string }
): void {
  const { userId, roleId } = options;

  // 1. Sync Anti-Nuke
  const nuke = getAntiNukeConfig(guildId);
  updateAntiNukeConfig(guildId, {
    whitelistedUsers: userId
      ? (nuke.whitelistedUsers || []).filter((id) => id !== userId)
      : nuke.whitelistedUsers,
    whitelistedRoles: roleId
      ? (nuke.whitelistedRoles || []).filter((id) => id !== roleId)
      : nuke.whitelistedRoles,
  });

  // 2. Sync Anti-Raid
  const raid = getAntiRaidConfig(guildId);
  updateAntiRaidConfig(guildId, (prev) => ({
    ...prev,
    whitelistedUsers: userId
      ? (prev.whitelistedUsers || []).filter((id) => id !== userId)
      : prev.whitelistedUsers,
    whitelistedRoles: roleId
      ? (prev.whitelistedRoles || []).filter((id) => id !== roleId)
      : prev.whitelistedRoles,
  }));

  // 3. Sync AutoMod
  const am = getAutoModConfig(guildId);
  updateAutoModConfig(guildId, {
    exemptUsers: userId
      ? (am.exemptUsers || []).filter((id) => id !== userId)
      : am.exemptUsers,
    exemptRoles: roleId
      ? (am.exemptRoles || []).filter((id) => id !== roleId)
      : am.exemptRoles,
  });
}

/**
 * 3-Way Atomic Synchronization: Clear whitelisted users, roles, or all across all subsystems.
 */
export function syncWhitelistClear(
  guildId: string,
  type: "users" | "roles" | "all"
): void {
  // 1. Anti-Nuke
  const nuke = getAntiNukeConfig(guildId);
  updateAntiNukeConfig(guildId, {
    whitelistedUsers: type === "roles" ? nuke.whitelistedUsers : [],
    whitelistedRoles: type === "users" ? nuke.whitelistedRoles : [],
  });

  // 2. Anti-Raid
  updateAntiRaidConfig(guildId, (prev) => ({
    ...prev,
    whitelistedUsers: type === "roles" ? prev.whitelistedUsers : [],
    whitelistedRoles: type === "users" ? prev.whitelistedRoles : [],
  }));

  // 3. AutoMod
  const am = getAutoModConfig(guildId);
  updateAutoModConfig(guildId, {
    exemptUsers: type === "roles" ? am.exemptUsers : [],
    exemptRoles: type === "users" ? am.exemptRoles : [],
  });
}
