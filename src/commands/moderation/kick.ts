import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "../../structures/Command";
import { addPunishment } from "../../lib/store";
import { BRAND } from "../../lib/brand";
import { isUniversalImmune } from "../../lib/universalWhitelist";

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

    if (isUniversalImmune(interaction.guild, user.id, member)) {
      await interaction.reply({
        content: "❌ You cannot kick or timeout a protected server administrator or whitelisted member.",
        ephemeral: true,
      });
      return;
    }
    if (!member) {
      await interaction.reply({
        content: "❌ That user is not in this server.",
        ephemeral: true,
      });
      return;
    }

    if (!member.moderatable) {
      await interaction.reply({
        content: "❌ I cannot timeout this user. Their role is higher than mine.",
        ephemeral: true,
      });
      return;
    }

    try {
      const durationMs = 12 * 60 * 60 * 1000;
      await member.timeout(durationMs, `[Policy: No Kick -> 12h Timeout] ${reason} (by ${interaction.user.tag})`);

      addPunishment({
        guildId: interaction.guild.id,
        userId: user.id,
        username: user.tag,
        kind: "timeout",
        reason: `[No-Kick Policy -> 12h Timeout] ${reason}`,
        durationDays: 0.5,
        staffId: interaction.user.id,
        staffTag: interaction.user.tag,
      });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.warning)
            .setTitle("🛡️ Server Policy: Timeout Enforced (No Kicks)")
            .setDescription(
              [
                `👤 **User:** ${user} (\`${user.tag}\`)`,
                `🛡️ **Moderator:** ${interaction.user}`,
                `⏳ **Action Taken:** 12-Hour Timeout (Kicks Disabled)`,
                `📝 **Reason:** ${reason}`,
                ``,
                `*ℹ️ Server policy strictly enforces **Timeout Only** (\`no banned no kick jus timeout\`).*`,
              ].join("\n")
            ),
        ],
      });
    } catch (err: any) {
      await interaction.reply({
        content: `❌ Failed to timeout user: ${err.message}`,
        ephemeral: true,
      });
    }
  },
};

export default command;
