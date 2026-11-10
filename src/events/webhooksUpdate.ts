import { Events, NonThreadGuildBasedChannel } from "discord.js";
import { handleAntiNukeEvent } from "../lib/antinukeManager";

export default {
  name: Events.WebhooksUpdate,
  once: false,
  async execute(channel: NonThreadGuildBasedChannel) {
    if (!channel.guild) return;

    await handleAntiNukeEvent({
      guild: channel.guild,
      auditType: 50, // AuditLogEvent.WebhookCreate
      moduleKey: "webhookCreate",
      moduleName: "Webhook Create",
      targetDetails: `Channel: #${channel.name} (\`${channel.id}\`)`,
    });
  },
};
