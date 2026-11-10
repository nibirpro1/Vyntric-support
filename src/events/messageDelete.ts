import { Events, Message, EmbedBuilder, TextChannel, PartialMessage } from "discord.js";
import { getCachedMessage, getLoggingConfig } from "../lib/loggingStore";

export default {
  name: Events.MessageDelete,
  once: false,
  async execute(message: Message | PartialMessage) {
    if (!message.guild) return;

    const cached = getCachedMessage(message.id);

    // If author is known to be a bot, skip
    if (message.author?.bot) return;

    const config = getLoggingConfig(message.guild.id);
    const targetChannelId = config.messageLogChannelId || config.logChannelId;
    if (!targetChannelId || !config.messageDelete) return;

    try {
      const channel =
        (message.guild.channels.cache.get(targetChannelId) as TextChannel | undefined) ||
        ((await message.guild.channels.fetch(targetChannelId).catch(() => null)) as TextChannel | null);

      if (!channel || !channel.isTextBased()) return;

      const authorTag = message.author?.tag || cached?.authorTag || "Unknown User";
      const authorId = message.author?.id || cached?.authorId || "Unknown ID";
      const authorAvatar =
        message.author?.displayAvatarURL() ||
        cached?.authorAvatar ||
        undefined;

      const content = message.content || cached?.content || "_No text content_";

      const embed = new EmbedBuilder()
        .setColor(0xed4245) // Carl-bot Red for Message Delete
        .setAuthor({
          name: authorTag,
          iconURL: authorAvatar,
        });

      let description = `**Message deleted in <#${message.channelId}>**\n\n${content}\n\n**Message ID:** ${message.id}`;

      // Attachments
      const attachments: string[] = [];
      if (message.attachments && message.attachments.size > 0) {
        message.attachments.forEach((a) => {
          attachments.push(`[${a.name}](${a.url})`);
        });
      } else if (cached && cached.attachments.length > 0) {
        cached.attachments.forEach((a) => {
          attachments.push(`[${a.name}](${a.url})`);
        });
      }

      if (attachments.length > 0) {
        description += `\n**Attachments:**\n${attachments.join("\n")}`;
      }

      embed.setDescription(description);
      embed.setFooter({ text: `ID: ${authorId}` });
      embed.setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error("[log:messageDelete:error]", err);
    }
  },
};
