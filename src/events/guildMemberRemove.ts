import { Events, GuildMember, EmbedBuilder, TextChannel } from "discord.js";
import { formatWelcomeText, getWelcomeConfig } from "../lib/welcomeStore";
import { BRAND } from "../lib/brand";
import { getAntiNukeConfig } from "../lib/antinukeStore";
import { isImmune, checkRateLimit, executePunishment, sendAntiNukeAlert } from "../lib/antinukeManager";

export default {
  name: Events.GuildMemberRemove,
  once: false,
  async execute(member: GuildMember) {
    console.log(`[leave] Member left: ${member.user?.tag || member.id} (${member.id})`);

    // ─────────────────────────────────────────────────────────────
    // ANTI-NUKE: MASS MEMBER KICK DETECTION
    // ─────────────────────────────────────────────────────────────
    try {
      const antiNukeConfig = getAntiNukeConfig(member.guild.id);
      if (antiNukeConfig.enabled && antiNukeConfig.features.memberKick.enabled) {
        await new Promise((r) => setTimeout(r, 600));
        const auditLogs = await member.guild.fetchAuditLogs({
          limit: 3,
          type: 20, // AuditLogEvent.MemberKick
        });
        const entry = auditLogs.entries.find(
          (e) => e.targetId === member.id && Date.now() - e.createdTimestamp < 8000
        );

        if (entry && entry.executor && !isImmune(member.guild, entry.executor.id)) {
          const exceeded = checkRateLimit(
            member.guild.id,
            entry.executor.id,
            "memberKick",
            antiNukeConfig.features.memberKick.limit,
            antiNukeConfig.features.memberKick.windowSeconds
          );

          if (exceeded) {
            const punishmentResult = await executePunishment(
              member.guild,
              entry.executor.id,
              `Exceeded threshold on Member Kick`,
              antiNukeConfig
            );

            await sendAntiNukeAlert({
              guild: member.guild,
              executor: entry.executor,
              actionName: "Mass Member Kick",
              details: `Kicked Member: <@${member.id}> (\`${member.user?.tag || member.id}\`)`,
              punishmentResult,
              config: antiNukeConfig,
            });
          }
        }
      }
    } catch (err) {
      console.error("[antinuke:memberKick:error]", err);
    }

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
