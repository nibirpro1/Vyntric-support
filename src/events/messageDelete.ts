import { Events, Message, EmbedBuilder, TextChannel } from "discord.js";
import { getLoggingConfig } from "../lib/loggingStore";
import { BRAND } from "../lib/brand";

export default {
  name: Events.MessageDelete,
  once: false,
  async execute(message: Message) {
    if (!message.guild || message.author?.bot) return;

    const config = getLoggingConfig(message.guild.id);
    if (!config.logChannelId || !config.messageDelete) return;

    try {
      const channel = message.guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
      if (!channel || !channel.isTextBased()) return;

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.danger)
        .setAuthor({
          name: `${message.author?.tag || "Unknown User"} • Message Deleted`,
          iconURL: message.author?.displayAvatarURL(),
        })
        .setDescription(
          [
            `👤 **Author:** ${message.author} (\`${message.author?.id}\`)`,
            `📍 **Channel:** ${message.channel}`,
            "",
            "**Deleted Content:**",
            `\`\`\`\n${message.content ? message.content.slice(0, 1000) : "[No text content]"}\n\`\`\``,
          ].join("\n")
        )
        .setFooter({ text: `Message ID: ${message.id}` })
        .setTimestamp();

      if (message.attachments.size > 0) {
        const attachmentUrls = message.attachments.map((a) => a.url).join("\n");
        embed.addFields({ name: `📎 Attachments (${message.attachments.size})`, value: attachmentUrls });
      }

      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error("[log:messageDelete:error]", err);
    }
  },
};
