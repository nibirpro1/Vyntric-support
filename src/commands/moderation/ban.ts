import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "../../structures/Command";
import { addPunishment } from "../../lib/store";
import { BRAND } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user from the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The user to ban").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("Reason for the ban").setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("delete_days")
        .setDescription("Number of days of message history to delete (0-7)")
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") || "No reason provided";
    const deleteDays = interaction.options.getInteger("delete_days") || 0;

    const member = interaction.guild.members.cache.get(user.id);

    if (member && !member.bannable) {
      await interaction.reply({
        content: "❌ I cannot ban this user. Their role may be higher than mine.",
        ephemeral: true,
      });
      return;
    }

    try {
      await interaction.guild.members.ban(user.id, {
        reason: `${reason} (by ${interaction.user.tag})`,
        deleteMessageSeconds: deleteDays * 86400,
      });

      addPunishment({
        guildId: interaction.guild.id,
        userId: user.id,
        username: user.tag,
        kind: "ban",
        reason,
        durationDays: null,
        staffId: interaction.user.id,
        staffTag: interaction.user.tag,
      });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.danger)
            .setTitle("🔨 Member Banned")
            .setDescription(
              [
                `👤 **User:** ${user} (\`${user.tag}\`)`,
                `🛡️ **Moderator:** ${interaction.user}`,
                `📝 **Reason:** ${reason}`,
                deleteDays > 0 ? `🗑️ **Messages Deleted:** Past ${deleteDays} day(s)` : "",
              ]
                .filter(Boolean)
                .join("\n")
            ),
        ],
      });
    } catch (err: any) {
      await interaction.reply({
        content: `❌ Failed to ban: ${err.message}`,
        ephemeral: true,
      });
    }
  },
};

export default command;
