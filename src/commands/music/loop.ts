import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "../../structures/Command";
import { musicManager } from "../../music/MusicManager";
import { LoopMode } from "../../music/types";
import { BRAND } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("loop")
    .setDescription("Toggle or set music repeat mode")
    .addStringOption((opt) =>
      opt
        .setName("mode")
        .setDescription("Loop mode")
        .setRequired(true)
        .addChoices(
          { name: "Off", value: "off" },
          { name: "🔂 Current Track", value: "track" },
          { name: "🔁 Entire Queue", value: "queue" }
        )
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) return;

    const mode = interaction.options.getString("mode", true) as LoopMode;
    const ok = musicManager.setLoop(interaction.guildId, mode);

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
          .setDescription(`🔁 Loop mode set to: **${mode.toUpperCase()}**`),
      ],
    });
  },
};

export default command;
