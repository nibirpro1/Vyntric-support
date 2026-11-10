import { DMChannel, Events, GuildChannel, NonThreadGuildBasedChannel } from "discord.js";
import { handleAntiNukeEvent } from "../lib/antinukeManager";

export default {
  name: Events.ChannelDelete,
  once: false,
  async execute(channel: DMChannel | NonThreadGuildBasedChannel) {
    if (!("guild" in channel) || !channel.guild) return;

    await handleAntiNukeEvent({
      guild: channel.guild,
      auditType: 12, // AuditLogEvent.ChannelDelete
      moduleKey: "channelDelete",
      moduleName: "Channel Delete",
      targetDetails: `Channel: #${channel.name} (\`${channel.id}\`)`,
      targetId: channel.id,
    });
  },
};
