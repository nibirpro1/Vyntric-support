import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "../../structures/Command";
import { musicManager } from "../../music/MusicManager";
import { BRAND } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("autoplay")
    .setDescription("Toggle or set Autoplay (Fuego-style radio mode for similar songs)")
    .addBooleanOption((opt) =>
      opt
        .setName("enabled")
        .setDescription("Turn autoplay on or off (leave empty to toggle)")
        .setRequired(false)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) return;

    const queue = musicManager.getQueue(interaction.guildId);
    if (!queue) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.warning)
            .setDescription("⚠️ No active music session in this server. Start playing with `/play` first!"),
        ],
        ephemeral: true,
      });
      return;
    }

    const memberVoice = (interaction.member as any)?.voice?.channelId;
    if (!memberVoice || memberVoice !== queue.voiceChannelId) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.danger)
            .setDescription("❌ You must be in the same voice channel as Vyntric Music to change settings."),
        ],
        ephemeral: true,
      });
      return;
    }

    const explicit = interaction.options.getBoolean("enabled");
    const newState =
      explicit !== null
        ? musicManager.setAutoplay(interaction.guildId, explicit)
        : musicManager.toggleAutoplay(interaction.guildId);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(newState ? BRAND.colors.success : BRAND.colors.neutral)
          .setTitle(newState ? "📻 Autoplay Enabled (Fuego Mode)" : "📻 Autoplay Disabled")
          .setDescription(
            newState
              ? "Similar tracks and YouTube mixes will automatically queue when the current playlist finishes!"
              : "Playback will finish and the bot will disconnect after the current queue ends."
          ),
      ],
    });

    await musicManager.sendControllerMessage(queue);
  },
};

export default command;
