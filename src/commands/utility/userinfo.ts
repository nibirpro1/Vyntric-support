import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "../../structures/Command";
import { BRAND } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("View comprehensive user profile, join dates, and roles")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("User to inspect").setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const user = interaction.options.getUser("user") || interaction.user;
    const member = (interaction.guild.members.cache.get(user.id) ||
      (await interaction.guild.members.fetch(user.id).catch(() => null))) as GuildMember | null;

    const embed = new EmbedBuilder()
      .setColor(member?.displayColor || BRAND.colors.primary)
      .setAuthor({ name: `${user.tag}`, iconURL: user.displayAvatarURL() })
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "🆔 User ID", value: `\`${user.id}\``, inline: true },
        { name: "🤖 Bot", value: user.bot ? "Yes" : "No", inline: true },
        {
          name: "📅 Created Account",
          value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>\n(<t:${Math.floor(user.createdTimestamp / 1000)}:R>)`,
          inline: true,
        }
      );

    if (member) {
      const roles = member.roles.cache
        .filter((r) => r.id !== interaction.guild!.id)
        .sort((a, b) => b.position - a.position)
        .map((r) => `<@&${r.id}>`);

      const rolesDisplay =
        roles.length > 0
          ? roles.slice(0, 15).join(", ") + (roles.length > 15 ? ` (+${roles.length - 15} more)` : "")
          : "None";

      embed.addFields(
        {
          name: "📥 Joined Server",
          value: member.joinedTimestamp
            ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>\n(<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)`
            : "Unknown",
          inline: true,
        },
        {
          name: "⭐ Highest Role",
          value: member.roles.highest ? `<@&${member.roles.highest.id}>` : "None",
          inline: true,
        },
        {
          name: `🎭 Roles (${roles.length})`,
          value: rolesDisplay,
        }
      );
    }

    embed.setFooter({ text: BRAND.footer }).setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
