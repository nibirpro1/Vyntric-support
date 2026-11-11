import { Events, Message, EmbedBuilder, TextChannel, PartialMessage } from "discord.js";
import { cacheMessage, getCachedMessage, getLoggingConfig } from "../lib/loggingStore";
import { executeAutoModCheck } from "../lib/automodEngine";

export default {
  name: Events.MessageUpdate,
  once: false,
  async execute(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) {
    if (!newMessage.guild || newMessage.author?.bot) return;

    // Fetch content if partial
    let resolvedNew = newMessage;
    if (resolvedNew.partial) {
      resolvedNew = await resolvedNew.fetch().catch(() => resolvedNew);
    }

    const cached = getCachedMessage(resolvedNew.id);
    const oldContent = oldMessage.content || cached?.content || null;
    const newContent = resolvedNew.content || null;

    // Run AutoMod check on edited content first to prevent edit-based filter bypass
    if (newContent) {
      await executeAutoModCheck(resolvedNew, true).catch((err) => {
        console.error("[automod:messageUpdate:error]", err);
      });
    }

    // Skip audit log if content didn't change (e.g. embed preview loaded)
    if (!oldContent || !newContent || oldContent === newContent) return;

    const config = getLoggingConfig(resolvedNew.guild!.id);
    const targetChannelId = config.messageLogChannelId || config.logChannelId;
    if (!targetChannelId || !config.messageUpdate) return;

    try {
      const channel =
        (resolvedNew.guild!.channels.cache.get(targetChannelId) as TextChannel | undefined) ||
        ((await resolvedNew.guild!.channels.fetch(targetChannelId).catch(() => null)) as TextChannel | null);

      if (!channel || !channel.isTextBased()) return;

      const authorTag = resolvedNew.author?.tag || cached?.authorTag || "Unknown User";
      const authorId = resolvedNew.author?.id || cached?.authorId || "Unknown ID";
      const authorAvatar =
        resolvedNew.author?.displayAvatarURL() ||
        cached?.authorAvatar ||
        undefined;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2) // Carl-bot Blurple for Message Edit
        .setAuthor({
          name: authorTag,
          iconURL: authorAvatar,
        })
        .setDescription(
          `**Message edited in <#${resolvedNew.channelId}>** [Jump to Message](${resolvedNew.url})\n\n` +
            `**Before:**\n${oldContent.slice(0, 1000)}\n\n` +
            `**+After:**\n${newContent.slice(0, 1000)}`
        )
        .setFooter({ text: `ID: ${authorId}` })
        .setTimestamp();

      await channel.send({ embeds: [embed] });

      // Update cached message with new content
      if ("attachments" in resolvedNew) {
        cacheMessage(resolvedNew as Message);
      }
    } catch (err) {
      console.error("[log:messageUpdate:error]", err);
    }
  },
};
