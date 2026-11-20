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
    .setName("shuffle")
    .setDescription("Randomly shuffle upcoming songs in the queue"),
  async execute(interaction: ChatInputCommandInteraction, client: VyntricClient) {
    if (!interaction.guildId) return;

    const ok = client.musicHandler.shuffle(interaction.guildId);
    if (!ok) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.warning)
            .setDescription("⚠️ Need at least 2 songs in the queue to shuffle."),
        ],
        flags: MessageFlags.Ephemeral,
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
