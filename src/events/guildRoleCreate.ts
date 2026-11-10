import { Events, Role } from "discord.js";
import { handleAntiNukeEvent } from "../lib/antinukeManager";

export default {
  name: Events.GuildRoleCreate,
  once: false,
  async execute(role: Role) {
    if (!role.guild) return;

    await handleAntiNukeEvent({
      guild: role.guild,
      auditType: 30, // AuditLogEvent.RoleCreate
      moduleKey: "roleCreate",
      moduleName: "Role Create",
      targetDetails: `Role: @${role.name} (\`${role.id}\`)`,
      targetId: role.id,
    });
  },
};
