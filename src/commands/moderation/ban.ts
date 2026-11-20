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

    if (user.id === "1495738572362481777" || user.id === interaction.guild.ownerId) {
      await interaction.reply({
        content: "❌ You cannot ban or timeout a protected server administrator or owner.",
        ephemeral: true,
      });
      return;
    }

    const member = interaction.guild.members.cache.get(user.id);

    if (member && !member.moderatable) {
      await interaction.reply({
        content: "❌ I cannot timeout this user. Their role may be higher than mine.",
        ephemeral: true,
      });
      return;
    }

    try {
      const durationMs = 24 * 60 * 60 * 1000;
      if (member) {
        await member.timeout(durationMs, `[Policy: No Ban -> 24h Timeout] ${reason} (by ${interaction.user.tag})`);
      }

      addPunishment({
        guildId: interaction.guild.id,
        userId: user.id,
        username: user.tag,
        kind: "timeout",
        reason: `[No-Ban Policy -> 24h Timeout] ${reason}`,
        durationDays: 1,
        staffId: interaction.user.id,
        staffTag: interaction.user.tag,
      });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.danger)
            .setTitle("🛡️ Server Policy: Timeout Enforced (No Bans)")
            .setDescription(
              [
                `👤 **User:** ${user} (\`${user.tag}\`)`,
                `🛡️ **Moderator:** ${interaction.user}`,
                `⏳ **Action Taken:** 24-Hour Timeout (Bans Disabled)`,
                `📝 **Reason:** ${reason}`,
                ``,
                `*ℹ️ Server policy strictly enforces **Timeout Only** (\`no banned no kick jus timeout\`).*`,
              ]
                .filter(Boolean)
                .join("\n")
            ),
        ],
      });
    } catch (err: any) {
      await interaction.reply({
        content: `❌ Failed to timeout member: ${err.message}`,
        ephemeral: true,
      });
    }
  },
};

export default command;
