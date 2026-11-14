import { Events, VoiceState, PermissionFlagsBits, EmbedBuilder, TextChannel } from "discord.js";
import { getAutoModConfig } from "../lib/automodStore";
import { BRAND } from "../lib/brand";

// Track rapid mute/unmute/deafen state changes: guildId:userId -> timestamps[]
const voiceSpamMap = new Map<string, number[]>();
// Track rapid VC channel switches: guildId:userId -> timestamps[]
const voiceHopMap = new Map<string, number[]>();

export default {
  name: Events.VoiceStateUpdate,
  once: false,
  async execute(oldState: VoiceState, newState: VoiceState) {
    const member = newState.member || oldState.member;
    const guild = newState.guild || oldState.guild;
    if (!member || !guild || member.user.bot) return;

    // 1. If member connects or switches channels while timed out (communication disabled):
    if (newState.channelId) {
      if (member.isCommunicationDisabled()) {
        try {
          await member.voice.disconnect("AutoMod: Active timeout penalty");
          console.log(`[automod:vc] Disconnected timed-out member ${member.user.tag} from #${newState.channel?.name}`);
        } catch {}
        return;
      }
    }

    // 2. Anti-Louding & Voice State Abuse Protection
    const autoMod = getAutoModConfig(guild.id);
    if (autoMod.enabled && autoMod.antiLouding && newState.channelId) {
      // Check for rapid self-mute / self-deafen toggling (trolls spamming mic clicks / crackling audio)
      const toggledState =
        oldState.selfMute !== newState.selfMute ||
        oldState.selfDeaf !== newState.selfDeaf;

      if (toggledState) {
        const key = `${guild.id}:${member.id}`;
        const now = Date.now();
        const timestamps = (voiceSpamMap.get(key) || []).filter((t) => now - t < 4000);
        timestamps.push(now);
        voiceSpamMap.set(key, timestamps);

        if (timestamps.length >= 8) {
          voiceSpamMap.delete(key);

          // Disconnect & 10-minute timeout for Anti-Louding
          try {
            if (member.voice.channel) {
              await member.voice.disconnect("AutoMod: Anti-Louding (Rapid Mic Noise Spam)").catch(() => {});
            }

            if (member.moderatable) {
              await member.timeout(10 * 60 * 1000, "AutoMod: Anti-Louding (VC Crackle & Mic Spam)");
            }

            // DM Notice
            if (autoMod.dmOnPunish) {
              const dmEmbed = new EmbedBuilder()
                .setColor(BRAND.colors.danger)
                .setTitle("⚠️ Disconnected & Timed Out for Voice Abuse")
                .setDescription(
                  `You were removed from **#${newState.channel?.name}** and timed out for **10 minutes** in **${guild.name}** for rapid microphone/noise spam (Anti-Louding protection).`
                )
                .setFooter({ text: `${BRAND.name} Voice Security` })
                .setTimestamp();

              await member.send({ embeds: [dmEmbed] }).catch(() => {});
            }

            // Mod Log notification
            if (autoMod.logChannelId) {
              const logChannel = guild.channels.cache.get(autoMod.logChannelId);
              if (logChannel && logChannel.isTextBased()) {
                const logEmbed = new EmbedBuilder()
                  .setColor(BRAND.colors.danger)
                  .setTitle("🛡️ AutoMod: Anti-Louding Infraction in Voice")
                  .setDescription(`**${member.user.tag}** was detected spamming mic/audio state in **#${newState.channel?.name}**.`)
                  .addFields(
                    { name: "Offender", value: `${member.user} (\`${member.id}\`)`, inline: true },
                    { name: "Voice Channel", value: `<#${newState.channelId}>`, inline: true },
                    { name: "Action Taken", value: "`Disconnected from VC` + `10m Timeout`", inline: true }
                  )
                  .setFooter({ text: BRAND.footer })
                  .setTimestamp();

                await (logChannel as TextChannel).send({ embeds: [logEmbed] }).catch(() => {});
              }
            }
          } catch (err) {
            console.error("[automod:vc:antiLouding:error]", err);
          }
        }
      }
    }

    // 3. Anti-VC Hopping / Raid Protection (Trolls jumping across 5+ VCs within 5s to disrupt chats)
    if (autoMod.enabled && oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      const hopKey = `hop:${guild.id}:${member.id}`;
      const now = Date.now();
      const hopTimes = (voiceHopMap.get(hopKey) || []).filter((t) => now - t < 5000);
      hopTimes.push(now);
      voiceHopMap.set(hopKey, hopTimes);

      if (hopTimes.length >= 5) {
        voiceHopMap.delete(hopKey);
        try {
          if (member.voice.channel) {
            await member.voice.disconnect("AutoMod: Excessive Voice Channel Hopping").catch(() => {});
          }

          if (member.moderatable) {
            await member.timeout(5 * 60 * 1000, "AutoMod: Excessive Voice Channel Hopping / Sound Spam");
          }

          if (autoMod.dmOnPunish) {
            const dmEmbed = new EmbedBuilder()
              .setColor(BRAND.colors.warning)
              .setTitle("⚠️ Disconnected for Voice Channel Hopping")
              .setDescription(
                `You were disconnected and timed out for **5 minutes** in **${guild.name}** for rapidly hopping between voice channels.`
              )
              .setFooter({ text: `${BRAND.name} Voice Security` })
              .setTimestamp();

            await member.send({ embeds: [dmEmbed] }).catch(() => {});
          }

          if (autoMod.logChannelId) {
            const logChannel = guild.channels.cache.get(autoMod.logChannelId);
            if (logChannel && logChannel.isTextBased()) {
              const logEmbed = new EmbedBuilder()
                .setColor(BRAND.colors.warning)
                .setTitle("🛡️ AutoMod: Voice Channel Hopping Spam")
                .setDescription(`**${member.user.tag}** was detected rapidly hopping between voice channels.`)
                .addFields(
                  { name: "Offender", value: `${member.user} (\`${member.id}\`)`, inline: true },
                  { name: "Action Taken", value: "`Disconnected from VC` + `5m Timeout`", inline: true }
                )
                .setFooter({ text: BRAND.footer })
                .setTimestamp();

              await (logChannel as TextChannel).send({ embeds: [logEmbed] }).catch(() => {});
            }
          }
        } catch (err) {
          console.error("[automod:vc:hop:error]", err);
        }
      }
    }
  },
};
