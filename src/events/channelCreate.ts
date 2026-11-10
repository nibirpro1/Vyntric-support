import { Events, NonThreadGuildBasedChannel } from "discord.js";
import { handleAntiNukeEvent } from "../lib/antinukeManager";

export default {
  name: Events.ChannelCreate,
  once: false,
  async execute(channel: NonThreadGuildBasedChannel) {
    if (!channel.guild) return;

    await handleAntiNukeEvent({
      guild: channel.guild,
      auditType: 10, // AuditLogEvent.ChannelCreate
      moduleKey: "channelCreate",
      moduleName: "Channel Create",
      targetDetails: `Channel: #${channel.name} (\`${channel.id}\`)`,
      targetId: channel.id,
    });
  },
};
