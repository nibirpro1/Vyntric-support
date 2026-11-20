import {
  ChatInputCommandInteraction,
  GuildMember,
  MessageFlags,
  SlashCommandBuilder,
  VoiceBasedChannel,
} from "discord.js";
import { Command } from "../../structures/Command";
import { VyntricClient } from "../../structures/VyntricClient";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song or playlist (YouTube, Spotify, SoundCloud, direct link)")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("Song name, artist, or music URL")
        .setRequired(true)
    ),
  async execute(interaction: ChatInputCommandInteraction, client: VyntricClient) {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice?.channel as VoiceBasedChannel | null;

    if (!voiceChannel) {
      await interaction.reply({
        content: "🔊 You need to join a voice channel first before playing music!",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const query = interaction.options.getString("query", true);

    await interaction.reply({ content: `🔎 Searching for: **${query}**...`, flags: MessageFlags.Ephemeral });

    const result = await client.musicHandler.play(
      member,
      query,
      interaction.channel as any
    );

    if (interaction.channel && "send" in interaction.channel) {
      await (interaction.channel as any).send({ content: result }).catch(() => {});
    } else {
      await interaction.followUp({ content: result });
    }
  },
};

export default command;
