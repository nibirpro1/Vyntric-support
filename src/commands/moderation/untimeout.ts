import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "../../structures/Command";
import { BRAND } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove timeout from a member")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The member to untimeout").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("Reason for removing timeout").setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") || "Timeout removed";

    const member = interaction.guild.members.cache.get(user.id);
    if (!member) {
      await interaction.reply({
        content: "❌ That member is not in this server.",
        ephemeral: true,
      });
      return;
    }

    try {
      await member.timeout(null, `${reason} (by ${interaction.user.tag})`);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.success)
            .setTitle("✅ Timeout Removed")
            .setDescription(
              [
                `👤 **Member:** ${user} (\`${user.tag}\`)`,
                `🛡️ **Moderator:** ${interaction.user}`,
                `📝 **Reason:** ${reason}`,
              ].join("\n")
            ),
        ],
      });
    } catch (err: any) {
      await interaction.reply({
        content: `❌ Failed to remove timeout: ${err.message}`,
        ephemeral: true,
      });
    }
  },
};

export default command;
