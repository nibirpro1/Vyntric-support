import { Events, Message, EmbedBuilder, TextChannel } from "discord.js";
import { getLoggingConfig } from "../lib/loggingStore";
import { BRAND } from "../lib/brand";

export default {
  name: Events.MessageUpdate,
  once: false,
  async execute(oldMessage: Message, newMessage: Message) {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return; // e.g. embed update only

    const config = getLoggingConfig(newMessage.guild.id);
    if (!config.logChannelId || !config.messageUpdate) return;

    try {
      const channel = newMessage.guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
      if (!channel || !channel.isTextBased()) return;

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.warning)
        .setAuthor({
          name: `${newMessage.author?.tag || "Unknown User"} • Message Edited`,
          iconURL: newMessage.author?.displayAvatarURL(),
        })
        .setDescription(
          [
            `👤 **Author:** ${newMessage.author} (\`${newMessage.author?.id}\`)`,
            `📍 **Channel:** ${newMessage.channel}`,
            `🔗 **Jump:** [View Message](${newMessage.url})`,
            "",
            "**Before:**",
            `\`\`\`\n${oldMessage.content ? oldMessage.content.slice(0, 500) : "[Empty]"}\n\`\`\``,
            "**After:**",
            `\`\`\`\n${newMessage.content ? newMessage.content.slice(0, 500) : "[Empty]"}\n\`\`\``,
          ].join("\n")
        )
        .setFooter({ text: `Message ID: ${newMessage.id}` })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error("[log:messageUpdate:error]", err);
    }
  },
};
