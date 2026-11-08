import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { Command } from "../../structures/Command";
import { musicManager } from "../../music/MusicManager";
import { BRAND } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("shuffle")
    .setDescription("Randomly shuffle upcoming songs in the queue"),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) return;

    const ok = musicManager.shuffle(interaction.guildId);
    if (!ok) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.warning)
            .setDescription("⚠️ Need at least 2 songs in the queue to shuffle."),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(BRAND.colors.primary)
          .setDescription("🔀 **Queue shuffled!** Enjoy the mix."),
      ],
    });
  },
};

export default command;
