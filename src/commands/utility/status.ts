import {
  ChatInputCommandInteraction,
  GuildMember,
  MessageFlags,
  SlashCommandBuilder,
  VoiceChannel,
} from "discord.js";
import { getStatusSettings, getTempChannel } from "../../lib/tempVoiceStore";
import { buildStatusPanelPayload } from "../../lib/tempVoiceManager";

export default {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Open the Game / Among Us status moderation interface in your room"),

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

    const settings = getStatusSettings(voiceChannel.id);
    const isOwner = tempRecord.ownerId === member.id;
    const isExtraOwner = settings.extraOwners?.includes(member.id);

    if (!isOwner && !isExtraOwner) {
      await interaction.reply({
        content: `❌ Only the channel owner (<@${tempRecord.ownerId}>) or extra owners can use this panel!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const panel = buildStatusPanelPayload(settings, member, tempRecord.ownerId);
    await interaction.reply({ ...panel, flags: MessageFlags.Ephemeral });
  },
};
