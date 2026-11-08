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
    .setName("nowplaying")
    .setDescription("Show the currently playing track with interactive control buttons"),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) return;

    const queue = musicManager.getQueue(interaction.guildId);
    if (!queue || !queue.currentTrack) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.neutral)
            .setDescription("🎵 No music is currently playing in this server."),
        ],
        ephemeral: true,
      });
      return;
    }

    const embed = musicManager.buildNowPlayingEmbed(queue);
    const components = musicManager.buildControllerComponents(queue);

    await interaction.reply({
      embeds: [embed],
      components,
    });
  },
};

export default command;
