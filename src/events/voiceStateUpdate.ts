import { Events, VoiceState, PermissionFlagsBits, EmbedBuilder, TextChannel } from "discord.js";
import { getAutoModConfig } from "../lib/automodStore";
import { isUserVcBanned, getVcBan } from "../lib/vcBanStore";
import { handleBotVoiceState } from "../lib/vc247Manager";
import { handleTempVoiceStateUpdate } from "../lib/tempVoiceManager";
import { logVoiceChannelActivity } from "../lib/loggingStore";
import { BRAND } from "../lib/brand";

// Track rapid mute/unmute/deafen state changes: guildId:userId -> timestamps[]
const voiceSpamMap = new Map<string, number[]>();
// Track rapid VC channel switches: guildId:userId -> timestamps[]
const voiceHopMap = new Map<string, number[]>();
// Track rapid connect/disconnect spam: guildId:userId -> timestamps[]
const voiceGhostMap = new Map<string, number[]>();

export default {
  name: Events.VoiceStateUpdate,
  once: false,
  async execute(oldState: VoiceState, newState: VoiceState) {
    const member = newState.member || oldState.member;
    const guild = newState.guild || oldState.guild;

    // 0. 24/7 Voice Guardian: Ensure bot stays locked to designated 24/7 VC
    if (member && guild?.client?.user && member.id === guild.client.user.id) {
      await handleBotVoiceState(oldState, newState, guild.client as any);
      return;
    }

    if (!member || !guild || member.user.bot) return;

    // 1. Enforce VC Ban (Instant kick if member is VC-banned in this server)
    if (newState.channelId && isUserVcBanned(guild.id, member.id)) {
      const banRecord = getVcBan(guild.id, member.id);
      try {
        await member.voice.disconnect("AutoMod: Active VC Ban penalty");
        console.log(`[automod:vc] Disconnected VC-banned member ${member.user.tag} from #${newState.channel?.name}`);

        const dmEmbed = new EmbedBuilder()
          .setColor(BRAND.colors.danger)
          .setTitle("🚫 Voice Channel Access Denied")
          .setDescription(`You are **VC-Banned** in **${guild.name}** and are not permitted to join any voice channel.`)
          .addFields(
            { name: "Reason", value: `\`${banRecord?.reason || "VC Ban enforced by staff"}\``, inline: true },
            { name: "Issued By", value: `${banRecord?.staffTag || "Staff Moderator"}`, inline: true }
          )
          .setFooter({ text: `${BRAND.name} Voice Security` })
          .setTimestamp();

        await member.send({ embeds: [dmEmbed] }).catch(() => {});
      } catch (err) {
        console.error("[automod:vc:ban_kick:error]", err);
      }
      return;
    }

    // 2. If member connects or switches channels while timed out (communication disabled):
    if (newState.channelId) {
      if (member.isCommunicationDisabled()) {
        try {
          await member.voice.disconnect("AutoMod: Active timeout penalty");
          console.log(`[automod:vc] Disconnected timed-out member ${member.user.tag} from #${newState.channel?.name}`);
        } catch {}
        return;
      }
    }

    // 2.5 TempVoice / Join-to-Create handler (Astro / TempVoice system)
    await handleTempVoiceStateUpdate(oldState, newState);

    // 2.7 Voice Channel Activity Logger (Log to #join-log: 1508548021808398346)
    await logVoiceChannelActivity(oldState, newState);

    const autoMod = getAutoModConfig(guild.id);

    // 3. Anti-Ghost / Rapid Connect-Disconnect Spam (Trolls repeatedly clicking join/leave to spam chime sounds)
    const toggledConnection =
      (!oldState.channelId && newState.channelId) || (oldState.channelId && !newState.channelId);
    if (autoMod.enabled && toggledConnection) {
      const ghostKey = `ghost:${guild.id}:${member.id}`;
      const now = Date.now();
      const ghostTimes = (voiceGhostMap.get(ghostKey) || []).filter((t) => now - t < 7000);
      ghostTimes.push(now);
      voiceGhostMap.set(ghostKey, ghostTimes);

      if (ghostTimes.length >= 6) {
        voiceGhostMap.delete(ghostKey);
        try {
          if (member.voice.channel) {
            await member.voice.disconnect("AutoMod: Rapid Voice Join/Leave Chime Spam").catch(() => {});
          }

          if (member.moderatable) {
            await member.timeout(5 * 60 * 1000, "AutoMod: Rapid Voice Channel Join/Leave Chime Spam");
          }

          if (autoMod.dmOnPunish) {
            const dmEmbed = new EmbedBuilder()
              .setColor(BRAND.colors.danger)
              .setTitle("⚠️ Timed Out for Voice Chime Spam")
              .setDescription(
                `You were timed out for **5 minutes** in **${guild.name}** for repeatedly connecting and disconnecting from voice channels to spam join chimes.`
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
                .setTitle("🛡️ AutoMod: Rapid Voice Connect/Disconnect Spam")
                .setDescription(`**${member.user.tag}** was detected spamming voice channel join/leave chimes.`)
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
          console.error("[automod:vc:ghost:error]", err);
        }
      }
    }

    // 4. Anti-Louding & Voice State Abuse Protection (Rapid self-mute/deafen crackling spam)
    if (autoMod.enabled && autoMod.antiLouding && newState.channelId) {
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

          try {
            if (member.voice.channel) {
              await member.voice.disconnect("AutoMod: Anti-Louding (Rapid Mic Noise Spam)").catch(() => {});
            }

            if (member.moderatable) {
              await member.timeout(10 * 60 * 1000, "AutoMod: Anti-Louding (VC Crackle & Mic Spam)");
            }

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

    // 5. Anti-VC Hopping / Raid Protection (Trolls jumping across 5+ VCs within 5s)
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
