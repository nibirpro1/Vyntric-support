import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "../../structures/Command";
import { VyntricClient } from "../../structures/VyntricClient";
import { canManageStaff } from "../../lib/permissions";
import { vyntricEmbed, section } from "../../lib/brand";
import { awardMvp, listMvp } from "../../lib/store";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("staffmvp")
    .setDescription("Vyntric Staff of the Month & recognition system")
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .addSubcommand((sub) =>
      sub
        .setName("award")
        .setDescription("Award Staff of the Month / MVP honors")
        .addUserOption((opt) =>
          opt
            .setName("member")
            .setDescription("The team member receiving the honor")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("month")
            .setDescription("Month/Period (e.g. 'October 2026')")
            .setRequired(true)
            .setMaxLength(50)
        )
        .addStringOption((opt) =>
          opt
            .setName("reason")
            .setDescription("Reason for recognition / outstanding contributions")
            .setRequired(true)
            .setMaxLength(400)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("View the Vyntric Staff Hall of Fame")
    ),

  async execute(interaction: ChatInputCommandInteraction, _client: VyntricClient) {
    if (!interaction.guild || !interaction.member) return;
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

    const sub = interaction.options.getSubcommand();

    if (sub === "award") {
      if (!member || !canManageStaff(member)) {
        await interaction.reply({
          content: "🛡️ Only Lead Staff / Administrators can grant Staff of the Month honors.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const target = interaction.options.getUser("member", true);
      const month = interaction.options.getString("month", true);
      const reason = interaction.options.getString("reason", true);

      const record = awardMvp({
        guildId: interaction.guild.id,
        userId: target.id,
        username: target.tag,
        month,
        reason,
        awardedById: interaction.user.id,
        awardedByTag: interaction.user.tag,
      });

      const embed = vyntricEmbed("gold")
        .setTitle(`🏆 Vyntric Staff of the Month — ${record.month}`)
        .setDescription(
          `${section("⭐ Outstanding Contribution Award ⭐")}\n\n` +
            `🎉 Congratulations to <@${record.userId}> for being named **Staff of the Month**!\n\n` +
            `• **Honoree:** <@${record.userId}> (\`${record.username}\`)\n` +
            `• **Recognition Period:** **${record.month}**\n` +
            `• **Outstanding Achievements:**\n> _"${record.reason}"_\n\n` +
            `✨ _Thank you for your dedication, consistency, and hard work in making the Vyntric ecosystem awesome!_\n\n` +
            `• **Awarded By:** <@${record.awardedById}>`
        );

      await interaction.reply({
        content: `🎊 Let's congratulate <@${record.userId}> on earning **Staff of the Month**! 👏`,
        embeds: [embed],
      });
      return;
    }

    if (sub === "list") {
      const mvps = listMvp(interaction.guild.id);
      if (mvps.length === 0) {
        await interaction.reply({
          content: "🏆 No Staff of the Month awards recorded yet.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const lines = mvps.slice(0, 10).map((m) => {
        return `🏆 **${m.month}** — <@${m.userId}>\n↳ _"${m.reason}"_ (Awarded by <@${m.awardedById}>)`;
      });

      const embed = vyntricEmbed("gold")
        .setTitle("🏛️ Vyntric Staff Hall of Fame")
        .setDescription(`${section("Past Honorees")}\n${lines.join("\n\n")}`);

      await interaction.reply({ embeds: [embed] });
      return;
    }
  },
};

export default command;
