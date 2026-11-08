import { Events, GuildMember, EmbedBuilder, TextChannel } from "discord.js";
import { formatWelcomeText, getWelcomeConfig } from "../lib/welcomeStore";
import { BRAND } from "../lib/brand";

export default {
  name: Events.GuildMemberRemove,
  once: false,
  async execute(member: GuildMember) {
    const config = getWelcomeConfig(member.guild.id);
    if (!config.leaveChannelId) return;

    try {
      const channel = member.guild.channels.cache.get(config.leaveChannelId) as TextChannel | undefined;
      if (channel && channel.isTextBased()) {
        const desc = formatWelcomeText(config.leaveMessage, member);

        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.danger)
          .setAuthor({
            name: `${member.user.tag} left the server`,
            iconURL: member.user.displayAvatarURL(),
          })
          .setDescription(desc)
          .addFields(
            { name: "👥 Remaining Members", value: `**${member.guild.memberCount}**`, inline: true }
          )
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      }
    } catch (err) {
      console.error("[leave:channel:error]", err);
    }
  },
};
