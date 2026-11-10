import { Events, Message, EmbedBuilder, TextChannel, PartialMessage } from "discord.js";
import { cacheMessage, getCachedMessage, getLoggingConfig } from "../lib/loggingStore";

export default {
  name: Events.MessageUpdate,
  once: false,
  async execute(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) {
    if (!newMessage.guild || newMessage.author?.bot) return;

    const cached = getCachedMessage(newMessage.id);
    const oldContent = oldMessage.content || cached?.content || null;
    const newContent = newMessage.content || null;

    // Skip if content didn't change (e.g. embed preview loaded or reaction added)
    if (!oldContent || !newContent || oldContent === newContent) return;

    const config = getLoggingConfig(newMessage.guild.id);
    const targetChannelId = config.messageLogChannelId || config.logChannelId;
    if (!targetChannelId || !config.messageUpdate) return;

    try {
      const channel =
        (newMessage.guild.channels.cache.get(targetChannelId) as TextChannel | undefined) ||
        ((await newMessage.guild.channels.fetch(targetChannelId).catch(() => null)) as TextChannel | null);

      if (!channel || !channel.isTextBased()) return;

      const authorTag = newMessage.author?.tag || cached?.authorTag || "Unknown User";
      const authorId = newMessage.author?.id || cached?.authorId || "Unknown ID";
      const authorAvatar =
        newMessage.author?.displayAvatarURL() ||
        cached?.authorAvatar ||
        undefined;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2) // Carl-bot Blurple for Message Edit
        .setAuthor({
          name: authorTag,
          iconURL: authorAvatar,
        })
        .setDescription(
          `**Message edited in <#${newMessage.channelId}>** [Jump to Message](${newMessage.url})\n\n` +
            `**Before:**\n${oldContent.slice(0, 1000)}\n\n` +
            `**+After:**\n${newContent.slice(0, 1000)}`
        )
        .setFooter({ text: `ID: ${authorId}` })
        .setTimestamp();

      await channel.send({ embeds: [embed] });

      // Update cached message with new content
      if ("attachments" in newMessage) {
        cacheMessage(newMessage as Message);
      }
    } catch (err) {
      console.error("[log:messageUpdate:error]", err);
    }
  },
};
