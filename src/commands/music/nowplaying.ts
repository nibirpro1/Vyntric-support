import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
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

function createProgressBar(currentMs: number, totalMs: number, size = 14): string {
  if (!totalMs || totalMs <= 0) return "🔘" + "▬".repeat(size);
  const progress = Math.min(Math.max(currentMs / totalMs, 0), 1);
  const progressChars = Math.round(size * progress);
  const emptyChars = size - progressChars;
  return "▬".repeat(Math.max(0, progressChars - 1)) + "🔘" + "▬".repeat(Math.max(0, emptyChars));
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("nowplaying")
    .setDescription("Show the currently playing track"),
  async execute(interaction: ChatInputCommandInteraction, client: VyntricClient) {
    if (!interaction.guildId) return;

    const current = client.musicHandler.getNowPlaying(interaction.guildId);
    const player = client.musicHandler.players.get(interaction.guildId);

    if (!current || !player) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.neutral)
            .setDescription("🎵 No music is currently playing in this server."),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const { track } = current;
    const info = track.info;
    const position = player.position || 0;
    const duration = info.length || 0;
    const isStream = info.isStream;

    const loop = client.musicHandler.getLoop(interaction.guildId);
    const autoplay = client.musicHandler.isAutoplay(interaction.guildId);
    const queue = client.musicHandler.queue.get(interaction.guildId) || [];

    const timeString = isStream
      ? "🔴 LIVE STREAM"
      : `${formatMs(position)} / ${formatMs(duration)}`;

    const bar = isStream ? "🔴 ▬▬▬▬▬▬▬▬▬▬▬▬▬" : createProgressBar(position, duration, 14);

    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.primary)
      .setTitle("🎶 Now Playing")
      .setDescription(
        `[${info.title}](${info.uri || "https://discord.com"})\n\n` +
          `**Artist / Author:** ${info.author || "Unknown"}\n` +
          `**Progress:** \`${timeString}\`\n${bar}\n\n` +
          `🔊 **Volume:** \`${player.volume}%\` | 🔁 **Loop:** \`${loop.toUpperCase()}\` | 📻 **Autoplay:** \`${autoplay ? "ON" : "OFF"}\` | 📜 **In Queue:** \`${queue.length}\``
      )
      .setFooter({
        text: current.requestedBy ? `Requested by ${current.requestedBy}` : "Vyntric Music",
      })
      .setTimestamp();

    if (info.artworkUrl) {
      embed.setThumbnail(info.artworkUrl);
    }

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
