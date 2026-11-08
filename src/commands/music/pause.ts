import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { Command } from "../../structures/Command";
import { musicManager } from "../../music/MusicManager";
import { BRAND } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("pause")
    .setDescription("Pause current music playback"),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) return;

    const ok = musicManager.pause(interaction.guildId);
    if (!ok) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.warning)
            .setDescription("⚠️ Music is already paused or not playing."),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(BRAND.colors.primary)
          .setDescription("⏸️ **Playback paused.** Use `/resume` to continue."),
      ],
    });
  },
};

export default command;
