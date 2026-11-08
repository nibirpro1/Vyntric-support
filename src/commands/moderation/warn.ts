import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "../../structures/Command";
import { addPunishment, listPunishments } from "../../lib/store";
import { BRAND } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Issue or check member warnings")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Issue a formal warning to a member")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("The member to warn").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason for warning").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("View warnings and punishments for a member")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("The member to check").setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === "add") {
      const user = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason", true);

      const record = addPunishment({
        guildId,
        userId: user.id,
        username: user.tag,
        kind: "warn",
        reason,
        durationDays: null,
        staffId: interaction.user.id,
        staffTag: interaction.user.tag,
      });

      // Try sending a DM notice to warned user
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(BRAND.colors.warning)
          .setTitle(`⚠️ You have received a warning in ${interaction.guild.name}`)
          .setDescription(`**Reason:** ${reason}\n**Warning ID:** \`${record.id}\``)
          .setFooter({ text: "Please adhere to the server rules." })
          .setTimestamp();
        await user.send({ embeds: [dmEmbed] });
      } catch {}

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.warning)
            .setTitle("⚠️ Warning Issued")
            .setDescription(
              [
                `👤 **Member:** ${user} (\`${user.tag}\`)`,
                `🛡️ **Moderator:** ${interaction.user}`,
                `📝 **Reason:** ${reason}`,
                `🆔 **Case ID:** \`${record.id}\``,
              ].join("\n")
            ),
        ],
      });
    } else if (sub === "list") {
      const user = interaction.options.getUser("user", true);
      const punishments = listPunishments(guildId, user.id);

      if (punishments.length === 0) {
        await interaction.reply({
          content: `✅ **${user.tag}** has a clean record with 0 warnings or punishments!`,
          ephemeral: true,
        });
        return;
      }

      const lines = punishments.slice(0, 15).map(
        (p, i) =>
          `**${i + 1}.** [\`${p.kind.toUpperCase()}\`] ${p.reason} — by <@${p.staffId}> (<t:${Math.floor(p.createdAt / 1000)}:R>)`
      );

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.primary)
            .setTitle(`📜 Infraction History for ${user.tag}`)
            .setDescription(lines.join("\n\n"))
            .setFooter({ text: `Total Records: ${punishments.length}` }),
        ],
      });
    }
  },
};

export default command;
