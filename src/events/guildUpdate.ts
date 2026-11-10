import { Events, Guild } from "discord.js";
import { handleAntiNukeEvent } from "../lib/antinukeManager";

export default {
  name: Events.GuildUpdate,
  once: false,
  async execute(oldGuild: Guild, newGuild: Guild) {
    const changed =
      oldGuild.name !== newGuild.name ||
      oldGuild.icon !== newGuild.icon ||
      oldGuild.banner !== newGuild.banner ||
      oldGuild.vanityURLCode !== newGuild.vanityURLCode;

    if (!changed) return;

    await handleAntiNukeEvent({
      guild: newGuild,
      auditType: 1, // AuditLogEvent.GuildUpdate
      moduleKey: "guildUpdate",
      moduleName: "Server Update (Name/Icon/Vanity)",
      targetDetails: `Server updated: "${oldGuild.name}" ➔ "${newGuild.name}"`,
    });
  },
};
