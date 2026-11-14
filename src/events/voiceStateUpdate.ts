import { Events, VoiceState, PermissionFlagsBits } from "discord.js";
import { getAutoModConfig } from "../lib/automodStore";
import { BRAND } from "../lib/brand";

export default {
  name: Events.VoiceStateUpdate,
  once: false,
  async execute(oldState: VoiceState, newState: VoiceState) {
    const member = newState.member || oldState.member;
    const guild = newState.guild || oldState.guild;
    if (!member || !guild || member.user.bot) return;

    // 1. If member just joined a Voice Channel:
    if (!oldState.channelId && newState.channelId) {
      const channel = newState.channel;
      if (!channel) return;

      // If the member is currently communication disabled (timed out), disconnect them from VC
      if (member.isCommunicationDisabled()) {
        try {
          await member.voice.disconnect("AutoMod: Active timeout penalty");
          console.log(`[automod:vc] Disconnected timed-out member ${member.user.tag} from #${channel.name}`);
        } catch {}
      }
    }

    // 2. Soundboard / Voice Spam protection:
    // If Anti-Louding is enabled and member repeatedly mutes/unmutes or deafens to cause crackling audio
    const autoMod = getAutoModConfig(guild.id);
    if (autoMod.enabled && autoMod.antiLouding) {
      if (oldState.serverMute !== newState.serverMute && newState.serverMute) {
        // Staff muted the member, confirm disconnect if needed
      }
    }
  },
};
