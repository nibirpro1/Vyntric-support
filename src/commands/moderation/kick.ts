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
    .setName("kick")
    .setDescription("Kick a user from the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The user to kick").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("Reason for the kick").setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") || "No reason provided";

    const member = interaction.guild.members.cache.get(user.id);
    if (!member) {
      await interaction.reply({
        content: "❌ That user is not in this server.",
        ephemeral: true,
      });
      return;
    }

    if (!member.kickable) {
      await interaction.reply({
        content: "❌ I cannot kick this user. Their role is higher than mine.",
        ephemeral: true,
      });
      return;
    }

    try {
      await member.kick(`${reason} (by ${interaction.user.tag})`);

      addPunishment({
        guildId: interaction.guild.id,
        userId: user.id,
        username: user.tag,
        kind: "kick",
        reason,
        durationDays: null,
        staffId: interaction.user.id,
        staffTag: interaction.user.tag,
      });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.warning)
            .setTitle("👢 Member Kicked")
            .setDescription(
              [
                `👤 **User:** ${user} (\`${user.tag}\`)`,
                `🛡️ **Moderator:** ${interaction.user}`,
                `📝 **Reason:** ${reason}`,
              ].join("\n")
            ),
        ],
      });
    } catch (err: any) {
      await interaction.reply({
        content: `❌ Failed to kick: ${err.message}`,
        ephemeral: true,
      });
    }
  },
};

export default command;
