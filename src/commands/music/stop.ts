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
    .setName("stop")
    .setDescription("Stop music playback, clear queue, and disconnect from voice"),
  async execute(interaction: ChatInputCommandInteraction, client: VyntricClient) {
    if (!interaction.guildId) return;

    const ok = await client.musicHandler.stop(interaction.guildId);
    if (!ok) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.warning)
            .setDescription("⚠️ No active music session to stop."),
        ],
        flags: MessageFlags.Ephemeral,
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
