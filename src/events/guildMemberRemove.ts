import { Events, GuildMember, EmbedBuilder, TextChannel } from "discord.js";
import { formatWelcomeText, getWelcomeConfig } from "../lib/welcomeStore";
import { BRAND } from "../lib/brand";

export default {
  name: Events.GuildMemberRemove,
  once: false,
  async execute(member: GuildMember) {
    console.log(`[leave] Member left: ${member.user?.tag || member.id} (${member.id})`);

    const config = getWelcomeConfig(member.guild.id);
    if (!config.leaveChannelId) return;

    try {
      const channel =
        (member.guild.channels.cache.get(config.leaveChannelId) as TextChannel | undefined) ||
        (await member.guild.channels.fetch(config.leaveChannelId).catch(() => null) as TextChannel | null);

      if (channel && channel.isTextBased()) {
        const desc = formatWelcomeText(config.leaveMessage, member);

        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.danger)
          .setAuthor({
            name: `${member.user?.tag || "A member"} left the server`,
            iconURL: member.user?.displayAvatarURL(),
          })
          .setDescription(desc)
          .addFields(
            { name: "👥 Remaining Members", value: `**${member.guild.memberCount}**`, inline: true }
          )
          .setTimestamp();

        await channel.send({ embeds: [embed] });
        console.log(`[leave] Sent leave announcement to #${channel.name} for ${member.user?.tag || member.id}`);
      }
    } catch (err) {
      console.error("[leave:channel:error]", err);
    }
  },
};
