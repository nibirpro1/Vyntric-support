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
  async execute(interaction: ChatInputCommandInteraction, client: VyntricClient) {
    if (!interaction.guildId) return;

    const player = client.musicHandler.players.get(interaction.guildId);
    if (!player) {
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

    const mode = interaction.options.getString("mode", true) as "off" | "track" | "queue";
    client.musicHandler.setLoop(interaction.guildId, mode);

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
