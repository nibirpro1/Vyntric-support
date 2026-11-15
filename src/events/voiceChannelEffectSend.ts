import { Events, VoiceChannelEffect, EmbedBuilder, TextChannel } from "discord.js";
import { getAutoModConfig } from "../lib/automodStore";
import { BRAND } from "../lib/brand";

// Track rapid soundboard effects: guildId:userId -> timestamps[]
const soundboardSpamMap = new Map<string, number[]>();

export default {
  name: Events.VoiceChannelEffectSend,
  once: false,
  async execute(effect: VoiceChannelEffect) {
    if (!effect.guild || !effect.userId) return;

    // We specifically target soundboard audio effects (soundId is set)
    if (!effect.soundId) return;

    const guild = effect.guild;
    const autoMod = getAutoModConfig(guild.id);
    if (!autoMod.enabled || !autoMod.antiLouding) return;

    const member = await guild.members.fetch(effect.userId).catch(() => null);
    if (!member || member.user.bot) return;

    const key = `sb:${guild.id}:${member.id}`;
    const now = Date.now();
    const timestamps = (soundboardSpamMap.get(key) || []).filter((t) => now - t < 5000);
    timestamps.push(now);
    soundboardSpamMap.set(key, timestamps);

    if (timestamps.length >= 4) {
      soundboardSpamMap.delete(key);

      const channelName = effect.channel?.name || "Voice Channel";

      try {
        if (member.voice.channel) {
          await member.voice.disconnect("AutoMod: Anti-Louding (Soundboard Ear-Rape Spam)").catch(() => {});
        }

        if (member.moderatable) {
          await member.timeout(10 * 60 * 1000, "AutoMod: Anti-Louding (Soundboard Audio Spam)");
        }

        if (autoMod.dmOnPunish) {
          const dmEmbed = new EmbedBuilder()
            .setColor(BRAND.colors.danger)
            .setTitle("⚠️ Disconnected & Timed Out for Voice Audio Abuse")
            .setDescription(
              `You were disconnected from **#${channelName}** and timed out for **10 minutes** in **${guild.name}** for spamming soundboard effects (Anti-Louding Ear-Rape protection).`
            )
            .setFooter({ text: `${BRAND.name} Voice Security` })
            .setTimestamp();

          await member.send({ embeds: [dmEmbed] }).catch(() => {});
        }

        if (autoMod.logChannelId) {
          const logChannel = guild.channels.cache.get(autoMod.logChannelId);
          if (logChannel && logChannel.isTextBased()) {
            const logEmbed = new EmbedBuilder()
              .setColor(BRAND.colors.danger)
              .setTitle("🛡️ AutoMod: Soundboard Ear-Rape Detected")
              .setDescription(`**${member.user.tag}** was detected spamming soundboard audio in **#${channelName}**.`)
              .addFields(
                { name: "Offender", value: `${member.user} (\`${member.id}\`)`, inline: true },
                { name: "Voice Channel", value: `<#${effect.channelId}>`, inline: true },
                { name: "Action Taken", value: "`Disconnected from VC` + `10m Timeout`", inline: true }
              )
              .setFooter({ text: BRAND.footer })
              .setTimestamp();

            await (logChannel as TextChannel).send({ embeds: [logEmbed] }).catch(() => {});
          }
        }
      } catch (err) {
        console.error("[automod:vc:soundboard:error]", err);
      }
    }
  },
};
