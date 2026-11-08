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
    .setName("volume")
    .setDescription("Adjust the music playback volume")
    .addIntegerOption((opt) =>
      opt
        .setName("percent")
        .setDescription("Volume level from 1 to 100")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) return;

    const percent = interaction.options.getInteger("percent", true);
    const ok = musicManager.setVolume(interaction.guildId, percent);

    if (!ok) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.warning)
            .setDescription("⚠️ No active music session in this server."),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(BRAND.colors.primary)
          .setDescription(`🔊 Volume adjusted to **${percent}%**`),
      ],
    });
  },
};

export default command;
