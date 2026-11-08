import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { Command } from "../../structures/Command";
import { musicManager } from "../../music/MusicManager";
import { BRAND } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("resume")
    .setDescription("Resume paused music playback"),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) return;

    const ok = musicManager.resume(interaction.guildId);
    if (!ok) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.warning)
            .setDescription("⚠️ Music is already playing or no track is loaded."),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(BRAND.colors.success)
          .setDescription("▶️ **Playback resumed.**"),
      ],
    });
  },
};

export default command;
