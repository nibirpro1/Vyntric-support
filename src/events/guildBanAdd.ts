import { Events, GuildBan } from "discord.js";
import { handleAntiNukeEvent } from "../lib/antinukeManager";

export default {
  name: Events.GuildBanAdd,
  once: false,
  async execute(ban: GuildBan) {
    if (!ban.guild) return;

    await handleAntiNukeEvent({
      guild: ban.guild,
      auditType: 22, // AuditLogEvent.MemberBanAdd
      moduleKey: "memberBan",
      moduleName: "Member Ban",
      targetDetails: `Banned User: ${ban.user.tag} (\`${ban.user.id}\`)`,
      targetId: ban.user.id,
    });
  },
};
