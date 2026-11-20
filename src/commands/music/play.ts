import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  MessageFlags,
  SlashCommandBuilder,
  VoiceBasedChannel,
} from "discord.js";
import { Command } from "../../structures/Command";
import { VyntricClient } from "../../structures/VyntricClient";
import { BRAND } from "../../lib/brand";

function formatMs(ms: number): string {
  if (!ms || isNaN(ms) || ms < 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remMins = minutes % 60;
    return `${hours}:${remMins.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song or playlist (YouTube, Spotify, SoundCloud, Apple Music, direct link)")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("Song name, artist, YouTube/Spotify/Apple Music link")
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

    await interaction.reply({
      content: `🔎 Resolving: **${query.slice(0, 100)}**...`,
      flags: MessageFlags.Ephemeral,
    });

    const result = await client.musicHandler.play(
      member,
      query,
      interaction.channel as any
    );

    if (!result.success) {
      await interaction.editReply({ content: result.message });
      return;
    }

    await interaction.editReply({ content: result.message });

    // Build public announcement embed for channel
    const embed = new EmbedBuilder().setColor(BRAND.colors.primary);

    if (result.isPlaylist) {
      embed
        .setTitle(`🎶 Queued Playlist: ${result.playlistName || "Playlist"}`)
        .setDescription(
          `Enqueued **${result.tracksAdded}** tracks to the server playlist.\n\n` +
            `**First Up:** [${result.firstTrack?.info.title}](${result.firstTrack?.info.uri || "https://discord.com"})\n` +
            `👤 **Artist / Creator:** ${result.firstTrack?.info.author || "Unknown"}`
        )
        .setFooter({
          text: `Requested by ${member.user.tag}`,
          iconURL: member.user.displayAvatarURL(),
        })
        .setTimestamp();

      if (result.firstTrack?.info.artworkUrl) {
        embed.setThumbnail(result.firstTrack.info.artworkUrl);
      }
    } else {
      const info = result.firstTrack?.info;
      const isNowPlaying = result.message.startsWith("🎶 Playing");

      embed
        .setTitle(isNowPlaying ? "🎶 Now Playing" : "📜 Added to Queue")
        .setDescription(
          `[${info?.title}](${info?.uri || "https://discord.com"})\n\n` +
            `👤 **Artist / Channel:** ${info?.author || "Unknown"}\n` +
            `⏱️ **Duration:** \`${info?.isStream ? "🔴 LIVE" : formatMs(info?.length || 0)}\``
        )
        .setFooter({
          text: `Requested by ${member.user.tag}`,
          iconURL: member.user.displayAvatarURL(),
        })
        .setTimestamp();

      if (info?.artworkUrl) {
        embed.setThumbnail(info.artworkUrl);
      }
    }

    if (interaction.channel && "send" in interaction.channel) {
      await (interaction.channel as any).send({ embeds: [embed] }).catch(() => {});
    }
  },
};

export default command;
