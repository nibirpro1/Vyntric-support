import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "../../structures/Command";
import { VyntricClient } from "../../structures/VyntricClient";
import { BRAND } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("autoplay")
    .setDescription("Toggle or set Autoplay (automatically queue similar songs)")
    .addBooleanOption((opt) =>
      opt
        .setName("enabled")
        .setDescription("Turn autoplay on or off (leave empty to toggle)")
        .setRequired(false)
    ),
  async execute(interaction: ChatInputCommandInteraction, client: VyntricClient) {
    if (!interaction.guildId) return;

    const current = client.musicHandler.getNowPlaying(interaction.guildId);
    const player = client.musicHandler.players.get(interaction.guildId);

    if (!player && !current) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.warning)
            .setDescription(
              "⚠️ No active music session in this server. Start playing with `/play` first!"
            ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const explicit = interaction.options.getBoolean("enabled");
    const currentAutoplay = client.musicHandler.isAutoplay(interaction.guildId);
    const newState = explicit !== null ? explicit : !currentAutoplay;

    client.musicHandler.setAutoplay(interaction.guildId, newState);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(newState ? BRAND.colors.success : BRAND.colors.neutral)
          .setTitle(newState ? "📻 Autoplay Enabled" : "📻 Autoplay Disabled")
          .setDescription(
            newState
              ? "Similar tracks will automatically queue and play when the current song or queue finishes!"
              : "Autoplay is turned off. Playback will end when the current queue finishes."
          ),
      ],
    });
  },
};

export default command;
