import { Events, Role } from "discord.js";
import { handleAntiNukeEvent } from "../lib/antinukeManager";

export default {
  name: Events.GuildRoleDelete,
  once: false,
  async execute(role: Role) {
    if (!role.guild) return;

    await handleAntiNukeEvent({
      guild: role.guild,
      auditType: 32, // AuditLogEvent.RoleDelete
      moduleKey: "roleDelete",
      moduleName: "Role Delete",
      targetDetails: `Role: @${role.name} (\`${role.id}\`)`,
      targetId: role.id,
    });
  },
};
