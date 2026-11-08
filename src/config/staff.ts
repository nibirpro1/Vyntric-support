import { PermissionFlagsBits } from "discord.js";

/**
 * The Vyntric Tiers staff hierarchy.
 *
 * Every role below carries an explicit permission bitfield, so `/tester role`
 * can create a correct one instead of guessing. Nothing here can grant
 * `Administrator` or `ManageGuild`: those stay with Discord's own owner, because
 * a compromised tester account must not be able to escalate itself.
 *
 * `rank` is the hierarchy. A member may only grant a role whose rank is
 * strictly lower than their own highest role, which is what stops a Tier Tester
 * from promoting themselves to Head of Testing.
 */
export interface StaffRole {
  /** Stored in `settings.testerRoleIds` and friends. */
  key: string;
  /** Exact name used when the bot creates the role. */
  name: string;
  emoji: string;
  color: number;
  /** Higher rank outranks lower. Owners are treated as rank Infinity. */
  rank: number;
  /** What this role is allowed to do, rendered in `/tester roles`. */
  blurb: string;
  /** The exact permissions Discord will grant. */
  permissions: bigint[];
  /** Server channels this role must be able to read + post in. */
  channels: string[];
}

/**
 * Base reading/posting in a staff text channel. Every Vyntric staff role starts
 * here; the differences above it are the only thing that widens.
 */
const CHANNEL_BASE: bigint[] = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.SendMessagesInThreads,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.AddReactions,
  PermissionFlagsBits.UseExternalEmojis,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.UseApplicationCommands,
];

/** Reading channels it must not post in (staff logs, archives). */
const READ_ONLY: bigint[] = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory];

export const STAFF_ROLES: StaffRole[] = [
  {
    key: "tester",
    name: "Tiers Tester",
    emoji: "✅",
    color: 0x2fbf71,
    rank: 10,
    blurb: "Runs the actual tests. Can post test requests, post results, and log strikes.",
    permissions: [...CHANNEL_BASE],
    channels: ["high-tests", "high-results", "results", "tier-channels"],
  },
  {
    key: "moderator",
    name: "Tiers Moderator",
    emoji: "🛡️",
    color: 0x7cc7ec,
    rank: 20,
    blurb: "Everything a tester can do, plus issuing punishments and unlocking a Restricted member.",
    permissions: [
      ...CHANNEL_BASE,
      // Needed to apply and lift the `Restricted` role on a punished member.
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.ManageNicknames,
      PermissionFlagsBits.ManageMessages,
    ],
    channels: ["punishments", "staff-movements", "appeals"],
  },
  {
    key: "regulator",
    name: "Tiers Regulator",
    emoji: "⚖️",
    color: 0xf2c14e,
    rank: 30,
    blurb: "Handles appeals and disputes. Can also force a verified testing server on a fight.",
    permissions: [...CHANNEL_BASE, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageMessages],
    channels: ["appeals", "servers", "high-tests"],
  },
  {
    key: "head",
    name: "Head of Testing",
    emoji: "👑",
    color: 0xb1121f,
    rank: 40,
    blurb: "Runs the tester team. Promotes and demotes testers, and publishes the rules.",
    permissions: [
      ...CHANNEL_BASE,
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.ManageNicknames,
      PermissionFlagsBits.ManageMessages,
      // Creating the per-gamemode channels a new arena needs.
      PermissionFlagsBits.ManageChannels,
    ],
    channels: ["staff-movements", "servers", "rules"],
  },
];

export const STAFF_ROLE_BY_KEY: Record<string, StaffRole> = Object.fromEntries(
  STAFF_ROLES.map((role) => [role.key, role])
);

export function staffRole(key: string): StaffRole | undefined {
  return STAFF_ROLE_BY_KEY[key];
}

/** The bitfield a role needs, as a number Discord's REST API accepts. */
export function permissionBitfield(permissions: bigint[]): string {
  return permissions.reduce((acc, bit) => acc | bit, 0n).toString();
}

/**
 * Roles nobody may hand out through the bot, whatever their rank. `Administrator`
 * and `ManageGuild` are absent from every definition above; this is the second
 * lock on the same door, in case a role is ever edited in the Discord UI into
 * something the bot would then happily copy back out.
 */
export const FORBIDDEN_PERMISSIONS: bigint[] = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
];
