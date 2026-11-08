import {
  ChannelType,
  ChatInputCommandInteraction,
  ColorResolvable,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { Command } from "../../structures/Command";
import { BRAND } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Carl-bot style custom announcement embed builder")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Channel to send the embed to")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("title").setDescription("Embed title").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("description").setDescription("Embed description (use \\n for line breaks)").setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("color")
        .setDescription("Hex color code (e.g. #b1121f) or preset name")
        .setRequired(false)
        .addChoices(
          { name: "Vyntric Red (Default)", value: "#b1121f" },
          { name: "Emerald Green", value: "#2fbf71" },
          { name: "Gold Yellow", value: "#f2c14e" },
          { name: "Royal Blue", value: "#3a86ff" },
          { name: "Purple", value: "#8338ec" }
        )
    )
    .addStringOption((opt) =>
      opt.setName("thumbnail").setDescription("Thumbnail image URL").setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName("image").setDescription("Large banner image URL").setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName("footer").setDescription("Custom footer text").setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const channel = interaction.options.getChannel("channel", true) as TextChannel;
    const title = interaction.options.getString("title", true);
    const desc = interaction.options.getString("description", true).replace(/\\n/g, "\n");
    const color = (interaction.options.getString("color") || "#b1121f") as ColorResolvable;
    const thumbnail = interaction.options.getString("thumbnail");
    const image = interaction.options.getString("image");
    const footer = interaction.options.getString("footer");

    try {
      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(desc)
        .setTimestamp();

      if (thumbnail) embed.setThumbnail(thumbnail);
      if (image) embed.setImage(image);
      if (footer) {
        embed.setFooter({ text: footer });
      } else {
        embed.setFooter({ text: BRAND.footer });
      }

      await channel.send({ embeds: [embed] });

      await interaction.reply({
        content: `✅ Embed successfully posted in <#${channel.id}>!`,
        ephemeral: true,
      });
    } catch (err: any) {
      await interaction.reply({
        content: `❌ Could not send embed: ${err.message}`,
        ephemeral: true,
      });
    }
  },
};

export default command;
