import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { Command } from "../../structures/Command";
import { musicManager } from "../../music/MusicManager";
import { BRAND } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop music playback, clear queue, and disconnect from voice"),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) return;

    const ok = musicManager.stop(interaction.guildId);
    if (!ok) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.warning)
            .setDescription("⚠️ No active music session to stop."),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(BRAND.colors.danger)
          .setDescription("⏹️ **Playback stopped**, queue cleared, and disconnected."),
      ],
    });
  },
};

export default command;
