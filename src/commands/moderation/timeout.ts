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
    .setName("timeout")
    .setDescription("Timeout (mute) a member in the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The member to timeout").setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("minutes")
        .setDescription("Duration in minutes (e.g. 5, 60, 1440)")
        .setMinValue(1)
        .setMaxValue(40320)
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("Reason for timeout").setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const user = interaction.options.getUser("user", true);
    const minutes = interaction.options.getInteger("minutes", true);
    const reason = interaction.options.getString("reason") || "No reason provided";

    const member = interaction.guild.members.cache.get(user.id);
    if (!member) {
      await interaction.reply({
        content: "❌ That member is not in this server.",
        ephemeral: true,
      });
      return;
    }

    if (!member.moderatable) {
      await interaction.reply({
        content: "❌ I cannot timeout this member (higher role or permissions).",
        ephemeral: true,
      });
      return;
    }

    try {
      const ms = minutes * 60 * 1000;
      await member.timeout(ms, `${reason} (by ${interaction.user.tag})`);

      addPunishment({
        guildId: interaction.guild.id,
        userId: user.id,
        username: user.tag,
        kind: "timeout",
        reason,
        durationDays: Math.round((minutes / 1440) * 10) / 10,
        staffId: interaction.user.id,
        staffTag: interaction.user.tag,
      });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.warning)
            .setTitle("⏳ Member Timed Out")
            .setDescription(
              [
                `👤 **Member:** ${user} (\`${user.tag}\`)`,
                `⏱️ **Duration:** ${minutes} minute(s)`,
                `🛡️ **Moderator:** ${interaction.user}`,
                `📝 **Reason:** ${reason}`,
              ].join("\n")
            ),
        ],
      });
    } catch (err: any) {
      await interaction.reply({
        content: `❌ Failed to timeout: ${err.message}`,
        ephemeral: true,
      });
    }
  },
};

export default command;
