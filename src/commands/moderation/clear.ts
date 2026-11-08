import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  Message,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { Command } from "../../structures/Command";
import { BRAND } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Carl-bot style bulk message purge")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((opt) =>
      opt
        .setName("amount")
        .setDescription("Number of messages to delete (1-100)")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("Only delete messages sent by this specific user")
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    // Defer immediately so Discord never times out with "Unknown interaction" (3 second window)
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.guild || !interaction.channel) {
      await interaction.editReply({ content: "This command can only be used in a server channel." });
      return;
    }

    const channel = interaction.channel;
    if (!channel.isTextBased() || !("bulkDelete" in channel)) {
      await interaction.editReply({
        content: "❌ Messages cannot be bulk deleted in this type of channel.",
      });
      return;
    }

    const me = interaction.guild.members.me ?? (await interaction.guild.members.fetchMe().catch(() => null));
    if (me && !channel.permissionsFor(me)?.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.editReply({
        content: "❌ I need the **Manage Messages** permission in this channel to delete messages.",
      });
      return;
    }

    const amount = interaction.options.getInteger("amount", true);
    const targetUser = interaction.options.getUser("user");

    try {
      const fetchLimit = targetUser ? Math.min(100, Math.max(amount * 3, 50)) : amount;
      const fetched = await channel.messages.fetch({ limit: fetchLimit });

      let messagesToDelete: Message[] = Array.from(fetched.values());

      if (targetUser) {
        messagesToDelete = messagesToDelete.filter((m) => m.author.id === targetUser.id).slice(0, amount);
      }

      if (messagesToDelete.length === 0) {
        await interaction.editReply({
          content: `⚠️ No messages found to delete${targetUser ? ` from ${targetUser}` : ""}.`,
        });
        return;
      }

      // Bulk delete using Message[] array
      const deleted = await (channel as TextChannel).bulkDelete(messagesToDelete, true);

      // Handle any older messages that filterOld skipped (Discord 14-day limit)
      const remainingOld = messagesToDelete.filter((m) => !deleted.has(m.id));
      let manualDeletedCount = 0;

      if (remainingOld.length > 0 && remainingOld.length <= 10) {
        for (const oldMsg of remainingOld) {
          try {
            await oldMsg.delete();
            manualDeletedCount++;
          } catch {
            break;
          }
        }
      }

      const totalDeleted = deleted.size + manualDeletedCount;

      if (totalDeleted === 0) {
        await interaction.editReply({
          content: "⚠️ Could not delete messages because they are older than 14 days (Discord bulk delete restriction).",
        });
        return;
      }

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.success)
            .setDescription(
              `🧹 **Successfully deleted ${totalDeleted} message(s)**${
                targetUser ? ` from ${targetUser}` : ""
              }.${
                remainingOld.length > 10
                  ? `\n-# (${remainingOld.length} message(s) could not be bulk-deleted because Discord restricts messages older than 14 days)`
                  : ""
              }`
            ),
        ],
      });
    } catch (err: any) {
      console.error("[clear:error]", err);
      await interaction.editReply({
        content: `❌ Could not delete messages: ${err.message}`,
      });
    }
  },
};

export default command;
