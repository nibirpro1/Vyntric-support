import {
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "../../structures/Command";
import { BRAND } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("View server details, stats, boost level, and counts"),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;
    if (!guild) return;

    const channels = guild.channels.cache;
    const textCount = channels.filter((c) => c.type === ChannelType.GuildText).size;
    const voiceCount = channels.filter((c) => c.type === ChannelType.GuildVoice).size;
    const categoryCount = channels.filter((c) => c.type === ChannelType.GuildCategory).size;

    const owner = await guild.fetchOwner().catch(() => null);

    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.primary)
      .setTitle(`🏰 ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 256 }) || null)
      .addFields(
        { name: "👑 Owner", value: owner ? `${owner.user} (\`${owner.user.tag}\`)` : "Unknown", inline: true },
        { name: "🆔 Server ID", value: `\`${guild.id}\``, inline: true },
        {
          name: "📅 Created On",
          value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>\n(<t:${Math.floor(guild.createdTimestamp / 1000)}:R>)`,
          inline: true,
        },
        { name: "👥 Members", value: `**${guild.memberCount}** total`, inline: true },
        { name: "🎭 Roles", value: `**${guild.roles.cache.size}** roles`, inline: true },
        {
          name: "🚀 Server Boosts",
          value: `Tier **${guild.premiumTier}** (${guild.premiumSubscriptionCount || 0} boosts)`,
          inline: true,
        },
        {
          name: "📁 Channels",
          value: `💬 **${textCount}** text | 🔊 **${voiceCount}** voice | 📂 **${categoryCount}** categories`,
        }
      )
      .setFooter({ text: BRAND.footer })
      .setTimestamp();

    if (guild.bannerURL()) {
      embed.setImage(guild.bannerURL({ size: 1024 }) || null);
    }

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
