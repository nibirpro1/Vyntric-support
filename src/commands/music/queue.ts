import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "../../structures/Command";
import { musicManager } from "../../music/MusicManager";
import { BRAND } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Display the current server song queue")
    .addIntegerOption((opt) =>
      opt
        .setName("page")
        .setDescription("Queue page number (10 tracks per page)")
        .setMinValue(1)
        .setRequired(false)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) return;

    const queue = musicManager.getQueue(interaction.guildId);
    if (!queue || (!queue.currentTrack && queue.tracks.length === 0)) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.neutral)
            .setDescription("📭 The music queue is currently empty."),
        ],
        ephemeral: true,
      });
      return;
    }

    const page = (interaction.options.getInteger("page") ?? 1) - 1;
    const pageSize = 10;
    const totalPages = Math.ceil(queue.tracks.length / pageSize) || 1;

    if (page >= totalPages) {
      await interaction.reply({
        content: `⚠️ Page ${page + 1} does not exist. Total pages: ${totalPages}`,
        ephemeral: true,
      });
      return;
    }

    const start = page * pageSize;
    const currentSlice = queue.tracks.slice(start, start + pageSize);

    const trackLines = currentSlice.map(
      (t, idx) =>
        `**${start + idx + 1}.** [${t.title}](${t.url}) — \`${t.durationFormatted}\` (Requested by <@${t.requesterId}>)`
    );

    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.primary)
      .setTitle(`📜 Vyntric Music Queue • Page ${page + 1}/${totalPages}`)
      .setDescription(
        [
          queue.currentTrack
            ? `**Now Playing:** [${queue.currentTrack.title}](${queue.currentTrack.url}) (\`${queue.currentTrack.durationFormatted}\`)`
            : "No track currently playing.",
          "",
          "━━━━━━━━━━━━━━━━━━━━",
          "**Upcoming Tracks:**",
          trackLines.length > 0 ? trackLines.join("\n") : "_No more tracks in queue._",
          "━━━━━━━━━━━━━━━━━━━━",
          `Total Tracks: **${queue.tracks.length}**  |  Volume: **${queue.volume}%**  |  Loop: **${queue.loopMode.toUpperCase()}**`,
        ].join("\n")
      )
      .setFooter({ text: "Use /nowplaying for interactive control buttons" });

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
