import {
  ChatInputCommandInteraction,
  GuildMember,
  MessageFlags,
  SlashCommandBuilder,
  VoiceChannel,
} from "discord.js";
import { getTempChannel } from "../../lib/tempVoiceStore";
import { buildInterfacePayload, updateVoiceChannelInterface } from "../../lib/tempVoiceManager";

export default {
  data: new SlashCommandBuilder()
    .setName("interface")
    .setDescription("Resend the temporary voice channel control panel in your room"),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const member = interaction.member as GuildMember | null;
    if (!member || !member.voice.channel || !member.voice.channel.isVoiceBased()) {
      await interaction.reply({
        content: "❌ You must be connected to a temporary voice channel to use this command!",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const voiceChannel = member.voice.channel as VoiceChannel;
    const tempRecord = getTempChannel(voiceChannel.id);

    if (!tempRecord) {
      await interaction.reply({
        content: "❌ This is not an active temporary voice channel!",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (tempRecord.ownerId !== member.id) {
      await interaction.reply({
        content: `❌ Only the channel owner (<@${tempRecord.ownerId}>) can resend the control panel!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const payload = buildInterfacePayload(tempRecord, voiceChannel);
    const sentMsg = await voiceChannel.send(payload).catch(() => null);

    if (sentMsg) {
      tempRecord.interfaceMessageId = sentMsg.id;
    }

    await interaction.reply({
      content: "✅ Sent a fresh control panel into this voice channel's chat!",
      flags: MessageFlags.Ephemeral,
    });
  },
};
