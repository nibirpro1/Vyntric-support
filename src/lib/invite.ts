import { PermissionFlagsBits } from "discord.js";

/**
 * Permissions the Vyntric Support bot needs to run the ticket system:
 * - Manage Channels  -> create ticket channels + categories
 * - Manage Roles     -> apply per-ticket permission overwrites
 * - Manage Messages  -> pin the ticket header and manage closed channels
 */
export const INVITE_PERMISSIONS: Array<{ name: string; bit: bigint }> = [
  { name: "View Channels", bit: PermissionFlagsBits.ViewChannel },
  { name: "Send Messages", bit: PermissionFlagsBits.SendMessages },
  { name: "Embed Links", bit: PermissionFlagsBits.EmbedLinks },
  { name: "Attach Files", bit: PermissionFlagsBits.AttachFiles },
  { name: "Read Message History", bit: PermissionFlagsBits.ReadMessageHistory },
  { name: "Add Reactions", bit: PermissionFlagsBits.AddReactions },
  { name: "Manage Messages", bit: PermissionFlagsBits.ManageMessages },
  { name: "Manage Channels", bit: PermissionFlagsBits.ManageChannels },
  { name: "Manage Roles", bit: PermissionFlagsBits.ManageRoles },
  { name: "Connect (Voice)", bit: PermissionFlagsBits.Connect },
  { name: "Speak (Voice)", bit: PermissionFlagsBits.Speak },
  { name: "Ban Members", bit: PermissionFlagsBits.BanMembers },
  { name: "Kick Members", bit: PermissionFlagsBits.KickMembers },
  { name: "Timeout Members", bit: PermissionFlagsBits.ModerateMembers },
  // Needed so /uhc and /announcement can mention @everyone or @here.
  { name: "Mention @everyone, @here and All Roles", bit: PermissionFlagsBits.MentionEveryone },
];

export const INVITE_SCOPES = ["bot", "applications.commands"] as const;

export function invitePermissionsBitfield() {
  return INVITE_PERMISSIONS.reduce((total, permission) => total | permission.bit, 0n);
}

/**
 * Builds the OAuth2 authorisation URL used to invite the bot.
 * When a guild id is supplied Discord pre-selects that server.
 */
export function buildInviteUrl(options: { clientId: string; guildId?: string }) {
  const parts = [
    `client_id=${options.clientId}`,
    `permissions=${invitePermissionsBitfield().toString()}`,
    `scope=${INVITE_SCOPES.join("%20")}`,
  ];

  if (options.guildId) {
    parts.push(`guild_id=${options.guildId}`, "disable_guild_select=true");
  }

  return `https://discord.com/oauth2/authorize?${parts.join("&")}`;
}
