import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  VoiceBasedChannel,
} from "discord.js";
import { Command } from "../../structures/Command";
import { musicManager } from "../../music/MusicManager";
import { BRAND } from "../../lib/brand";

const platformIcons: Record<string, string> = {
  spotify: "🟢 Spotify",
  apple: "🍎 Apple Music",
  soundcloud: "🟠 SoundCloud",
  deezer: "🟣 Deezer",
  youtube: "🔴 YouTube",
  url: "🌐 Web Stream",
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play any song, playlist, or link (YouTube, Spotify, Apple Music, SoundCloud, etc.)")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("Song name, or link from YouTube, Spotify, Apple Music, SoundCloud, or web stream")
        .setRequired(true)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const member = interaction.member as any;
    const voiceChannel = member.voice?.channel as VoiceBasedChannel | null;

    if (!voiceChannel) {
      await interaction.reply({
        content: "🔊 You need to join a voice channel first before playing music!",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const query = interaction.options.getString("query", true);

    await interaction.deferReply();

    try {
      const queue = await musicManager.getOrCreateQueue(
        interaction.guild,
        voiceChannel,
        interaction.channel as any
      );

      const tracks = await musicManager.search(
        query,
        interaction.user.id,
        interaction.user.tag
      );

      if (!tracks || tracks.length === 0) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(BRAND.colors.warning)
              .setDescription(
                `❌ No playable tracks found for: **${query}**\n*(If this was a link, please check that it is not private or restricted)*`
              ),
          ],
        });
        return;
      }

      if (tracks.length === 1) {
        const track = tracks[0];
        queue.tracks.push(track);

        const platformLabel = platformIcons[track.platform] || "🎵 Music";
        const displayUrl = track.originalUrl || track.url;

        if (!queue.isPlaying && !queue.currentTrack) {
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(BRAND.colors.success)
                .setDescription(`🎶 Starting playback (${platformLabel}): **[${track.title}](${displayUrl})**`),
            ],
          });
          await musicManager.playNext(interaction.guild.id);
        } else {
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(BRAND.colors.primary)
                .setThumbnail(track.thumbnail || null)
                .setTitle("➕ Added to Queue")
                .setDescription(`**[${track.title}](${displayUrl})**`)
                .addFields(
                  { name: "👤 Artist", value: track.author, inline: true },
                  { name: "⏱️ Duration", value: track.durationFormatted, inline: true },
                  { name: "📍 Position", value: `#${queue.tracks.length}`, inline: true },
                  { name: "📻 Source", value: platformLabel, inline: true }
                )
                .setFooter({ text: `Requested by ${interaction.user.tag}` }),
            ],
          });
        }
      } else {
        // Multiple tracks extracted (e.g. playlist or album)
        for (const t of tracks) {
          queue.tracks.push(t);
        }

        const first = tracks[0];
        const platformLabel = platformIcons[first.platform] || "🎵 Music";

        if (!queue.isPlaying && !queue.currentTrack) {
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(BRAND.colors.success)
                .setTitle(`🎶 Added ${tracks.length} tracks to queue (${platformLabel})`)
                .setDescription(`Starting playback: **[${first.title}](${first.originalUrl || first.url})**`),
            ],
          });
          await musicManager.playNext(interaction.guild.id);
        } else {
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(BRAND.colors.primary)
                .setTitle(`➕ Added ${tracks.length} tracks to queue (${platformLabel})`)
                .setDescription(`All tracks queued successfully. Total in queue: **${queue.tracks.length}**`),
            ],
          });
        }
      }
    } catch (err: any) {
      console.error("[play:error]", err);
      await interaction.editReply({
        content: `❌ Could not connect or play: ${err.message || "Unknown error"}`,
      });
    }
  },
};

export default command;
