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
    .setName("queue")
    .setDescription("Show the current music queue"),
  async execute(interaction: ChatInputCommandInteraction, client: VyntricClient) {
    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const queue = client.musicHandler.queue.get(interaction.guild.id);
    const nowPlaying = client.musicHandler.getNowPlaying(interaction.guild.id);

    if ((!queue || queue.length === 0) && !nowPlaying) {
      await interaction.reply({
        content: "📜 **The queue is currently empty.** Use `/play` to add songs!",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const tracksList =
      queue && queue.length > 0
        ? queue
            .slice(0, 15)
            .map((t: any, i: number) => `**${i + 1}.** [${t.info.title}](${t.info.uri})`)
            .join("\n")
        : "*No upcoming songs in queue.*";

    const npText = nowPlaying
      ? `▶️ **Now Playing:** [${nowPlaying.track.info.title}](${nowPlaying.track.info.uri})\n\n`
      : "";

    const embed = new EmbedBuilder()
      .setTitle(`📜 Music Queue (${queue ? queue.length : 0} track${(queue?.length ?? 0) === 1 ? "" : "s"})`)
      .setDescription(`${npText}**Upcoming:**\n${tracksList}`)
      .setColor(BRAND.colors.primary)
      .setFooter({
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
