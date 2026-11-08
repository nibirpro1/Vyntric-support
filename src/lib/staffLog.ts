import { Guild, GuildMember, TextChannel } from "discord.js";
import { getSettings } from "./store";
import { vyntricEmbed } from "./brand";

/**
 * Staff movement + moderation log.
 *
 * Every privileged role change lands in one channel, in the same shape the
 * server's own `staff-movements` post uses. The reason a change can fail silently
 * in Discord — a moderator quietly editing a role, a bot below the role's
 * position, a mis-click — is exactly what this log is for.
 */
export interface StaffMovement {
  member: GuildMember;
  actor: GuildMember;
  roleName: string;
  roleId: string;
  direction: "add" | "remove";
  reason: string | null;
  /** Set when the change came from a punishment rather than a promotion. */
  fromPunishment?: boolean;
}

const ARROW = { add: "➕", remove: "➖" } as const;

/** Posts to the configured staff log, if one is set. Never throws. */
export async function logStaffMovement(guildId: string, movement: StaffMovement) {
  const { staffLogChannelId, punishmentsChannelId } = getSettings(guildId);
  if (!staffLogChannelId) return;

  const guild = movement.member.guild as Guild;
  const channel = guild.channels.cache.get(staffLogChannelId);
  if (!channel?.isTextBased()) return;

  const embed = vyntricEmbed(movement.direction === "add" ? "success" : "warning")
    .setTitle(`${ARROW[movement.direction]} ${movement.roleName}`)
    .setDescription(
      [
        `<@${movement.member.id}> ${movement.direction === "add" ? "➜" : "➜"} ${movement.roleName}`,
        movement.reason ? `\n**Reason:** ${movement.reason}` : "",
        movement.fromPunishment && punishmentsChannelId
          ? `\nLogged from <#${punishmentsChannelId}>.`
          : "",
      ]
        .filter(Boolean)
        .join("")
    )
    .setTimestamp()
    .setFooter({ text: `by ${movement.actor.user.tag}` });

  await (channel as TextChannel).send({ embeds: [embed] }).catch((err) => {
    console.error("[staffLog] could not write the movement log:", err.message);
  });
}
