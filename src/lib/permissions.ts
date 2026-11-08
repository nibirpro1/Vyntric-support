import {
  GuildMember,
  PermissionFlagsBits,
  TextChannel,
  ChannelType,
  Guild,
  CategoryChannel,
  Role,
} from "discord.js";
import { GuildSettings, getSettings, updateSettings } from "./store";
import { FORBIDDEN_PERMISSIONS, STAFF_ROLES, staffRole } from "../config/staff";

/** Members with Manage Server always count as staff. */
export function isHardStaff(member: GuildMember) {
  return member.permissions.has(PermissionFlagsBits.ManageGuild);
}

export function isTicketStaff(member: GuildMember, settings?: GuildSettings) {
  if (isHardStaff(member)) return true;
  const resolved = settings ?? getSettings(member.guild.id);
  return resolved.staffRoleIds.some((roleId) => member.roles.cache.has(roleId));
}

/* ============================================================================
   Vyntric Tiers staff
   --------------------------------------------------------------------------
   Deliberately separate from the ticket `staffRoleIds` list: ticket staff and
   tier testers are different jobs, and sharing one list would mean promoting
   someone to tester also silently hands them the ticket queue.
   ========================================================================== */

/** The registered Discord role ids for one rung of the hierarchy. */
export function roleIdsFor(guildId: string, key: string): string[] {
  const settings = getSettings(guildId);
  return settings.tierRoleIds?.[key] ?? [];
}

function registeredIn(guildId: string, key: string, roleId: string) {
  return roleIdsFor(guildId, key).includes(roleId);
}

/** Resolves a registered role id back to its catalogue rank. */
function rankOfRoleId(guildId: string, roleId: string): number {
  if (registeredIn(guildId, "head", roleId)) return 40;
  if (registeredIn(guildId, "regulator", roleId)) return 30;
  if (registeredIn(guildId, "moderator", roleId)) return 20;
  if (registeredIn(guildId, "tester", roleId)) return 10;
  return 0;
}

/** The highest hierarchy rung this member holds, or 0 when they hold none. */
export function tierRank(member: GuildMember): number {
  if (isHardStaff(member)) return Number.POSITIVE_INFINITY;

  let best = 0;
  for (const role of member.roles.cache.values()) {
    if (role.id === member.guild.id || role.managed) continue;
    best = Math.max(best, rankOfRoleId(member.guild.id, role.id));
  }
  return best;
}

/** Does this member hold the Tiers Tester role? */
export function isTierTester(member: GuildMember, settings?: GuildSettings) {
  const resolved = settings ?? getSettings(member.guild.id);
  return (resolved.tierRoleIds?.tester ?? []).some((roleId: string) =>
    member.roles.cache.has(roleId)
  );
}

/** Testers and above may run the tier write commands. */
export function canTest(member: GuildMember, settings?: GuildSettings) {
  return isHardStaff(member) || isTierTester(member, settings);
}

/** Moderators and above may issue and lift punishments. */
export function canModerate(member: GuildMember, settings?: GuildSettings) {
  if (isHardStaff(member)) return true;
  const ids = (settings ?? getSettings(member.guild.id)).tierRoleIds ?? {};
  return STAFF_ROLES.some(
    (role) => role.rank >= 20 && (ids[role.key] ?? []).some((id: string) => member.roles.cache.has(id))
  );
}

/** Head of Testing and above may move other staff around. */
export function canManageStaff(member: GuildMember, settings?: GuildSettings) {
  if (isHardStaff(member)) return true;
  const ids = (settings ?? getSettings(member.guild.id)).tierRoleIds ?? {};
  return (ids.head ?? []).some((id: string) => member.roles.cache.has(id));
}

/**
 * May `actor` hand out `key`?
 *
 * Two locks, both required:
 *   1. hierarchy  - the actor's rank must be strictly higher than the target's
 *   2. bot position - the bot's highest role must sit above the target role
 *
 * The second is Discord's own rule and the one most often forgotten: a bot that
 * cannot outrank the role silently fails to grant it, which looks to staff like
 * the command "did nothing".
 */
export function canGrantRole(
  actor: GuildMember,
  key: string,
  botMember: GuildMember
): { ok: true } | { ok: false; reason: string } {
  const target = staffRole(key);
  if (!target) return { ok: false, reason: "That is not a Vyntric staff role." };

  if (!canManageStaff(actor)) {
    return { ok: false, reason: "Only the Head of Testing can move staff around." };
  }

  const actorRank = tierRank(actor);
  if (actorRank <= target.rank) {
    return {
      ok: false,
      reason: `You cannot grant **${target.name}** - you have to outrank it, and it sits at or above you.`,
    };
  }

  const existing = actor.guild.roles.cache.find((r) => r.name === target.name);
  if (existing && existing.comparePositionTo(botMember.roles.highest) >= 0) {
    return {
      ok: false,
      reason: `**${target.name}** is already at or above my highest role. Drag it below me in Server Settings -> Roles, then retry.`,
    };
  }

  return { ok: true };
}

/**
 * Creates the Vyntric staff role with its exact permission bitfield.
 *
 * Administrator and ManageGuild are filtered out even though the catalogue
 * already omits them: this is the second lock on the same door, so editing a
 * definition later can never quietly hand a tester full control of the server.
 */
export async function ensureStaffRole(
  guild: Guild,
  key: string,
  botMember: GuildMember
): Promise<{ role: Role; created: boolean }> {
  const definition = staffRole(key);
  if (!definition) throw new Error(`Unknown staff role: ${key}`);

  const existing = guild.roles.cache.find((r) => r.name === definition.name);
  if (existing) return { role: existing, created: false };

  const permissions = definition.permissions.filter(
    (bit) => !FORBIDDEN_PERMISSIONS.includes(bit)
  );

  const role = await guild.roles.create({
    name: definition.name,
    color: definition.color,
    permissions: permissions.reduce((acc, bit) => acc | bit, 0n),
    reason: "Vyntric Support - staff role bootstrap",
  });

  // A freshly created role lands at the very bottom, which is the safest place
  // for a role the bot has to be able to grant.
  if (role.comparePositionTo(botMember.roles.highest) >= 0) {
    await role.setPosition(Math.max(1, botMember.roles.highest.position - 1));
  }

  return { role, created: true };
}

/** Registers a role id under a hierarchy key in the guild settings. */
export function registerRole(guildId: string, key: string, roleId: string | null) {
  const settings = getSettings(guildId);
  const current = { ...(settings.tierRoleIds ?? {}) };
  if (roleId) current[key] = [...new Set([...(current[key] ?? []), roleId])];
  else current[key] = [];
  return updateSettings(guildId, { tierRoleIds: current });
}

/**
 * A short, human-readable dump of a role's permissions.
 *
 * `/tester roles` prints this, so the answer to "what can this role actually
 * do?" is visible in Discord rather than buried inside a permission integer.
 */
export function describePermissions(roleId: string, guild: Guild): string {
  const role = guild.roles.cache.get(roleId);
  if (!role) return "_Role not found - it may have been deleted._";
  if (role.permissions.has(PermissionFlagsBits.Administrator)) return "**Administrator** (strip this)";

  const names = role.permissions
    .toArray()
    .filter((name) => !FORBIDDEN_PERMISSIONS.includes(PermissionFlagsBits[name] as bigint))
    .map((name) => `\`${name}\``);
  return names.length ? names.join(", ") : "_No permissions._";
}

export function staffMentions(settings: GuildSettings) {
  return settings.staffRoleIds.map((roleId) => `<@&${roleId}>`).join(" ");
}

/**
 * New tickets land in `settings.categoryId`; when unset the bot creates and
 * remembers a `Vyntric Tickets` category for the guild.
 */
export async function resolveTicketCategory(guild: Guild, settings: GuildSettings) {
  if (settings.categoryId) {
    const existing =
      guild.channels.cache.get(settings.categoryId) ??
      (await guild.channels.fetch(settings.categoryId).catch(() => null));
    if (existing?.type === ChannelType.GuildCategory) return existing as CategoryChannel;
  }

  const created = await guild.channels.create({
    name: "Vyntric Tickets",
    type: ChannelType.GuildCategory,
    reason: "Vyntric Support â€” ticket category",
  });
  updateSettings(guild.id, { categoryId: created.id });
  return created;
}

/** Closed tickets are moved here so the ticket category stays clean. */
export async function resolveArchiveCategory(guild: Guild, settings: GuildSettings) {
  if (settings.archiveCategoryId) {
    const existing =
      guild.channels.cache.get(settings.archiveCategoryId) ??
      (await guild.channels.fetch(settings.archiveCategoryId).catch(() => null));
    if (existing?.type === ChannelType.GuildCategory) return existing as CategoryChannel;
  }

  const created = await guild.channels.create({
    name: "Vyntric Archive",
    type: ChannelType.GuildCategory,
    reason: "Vyntric Support â€” closed ticket archive",
  });
  updateSettings(guild.id, { archiveCategoryId: created.id });
  return created;
}

export async function resolveLogChannel(guild: Guild, settings: GuildSettings) {
  if (!settings.logChannelId) return null;

  const channel =
    guild.channels.cache.get(settings.logChannelId) ??
    (await guild.channels.fetch(settings.logChannelId).catch(() => null));

  if (!channel || !channel.isTextBased()) return null;
  return channel as TextChannel;
}

/**
 * Sanitises a channel name into Discord's rules:
 * lowercase, dashes only, max 100 chars.
 */
export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "ticket";
}

export function padTicketNumber(number: number) {
  return number.toString().padStart(4, "0");
}


