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
    .setName("volume")
    .setDescription("Adjust the music playback volume")
    .addIntegerOption((opt) =>
      opt
        .setName("percent")
        .setDescription("Volume level from 10 to 200")
        .setMinValue(10)
        .setMaxValue(200)
        .setRequired(true)
    ),
  async execute(interaction: ChatInputCommandInteraction, client: VyntricClient) {
    if (!interaction.guildId) return;

    const percent = interaction.options.getInteger("percent", true);
    const ok = await client.musicHandler.setVolume(interaction.guildId, percent);

    if (!ok) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.warning)
            .setDescription("⚠️ No active music session in this server."),
        ],
        flags: MessageFlags.Ephemeral,
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
