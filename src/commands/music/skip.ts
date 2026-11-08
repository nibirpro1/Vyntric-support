import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { Command } from "../../structures/Command";
import { musicManager } from "../../music/MusicManager";
import { BRAND } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip the currently playing track"),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) return;

    const ok = musicManager.skip(interaction.guildId);
    if (!ok) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.warning)
            .setDescription("⚠️ Nothing is currently playing to skip."),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(BRAND.colors.primary)
          .setDescription("⏭️ **Skipped!** Playing next song in queue…"),
      ],
    });
  },
};

export default command;
