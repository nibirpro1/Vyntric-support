import {
  ChannelType,
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { Command } from "../../structures/Command";
import {
  buildCategorySelectRow,
  buildPanelEmbed,
  buildPanelRows,
  buildV2PanelEmbed,
  buildV2PanelRow,
} from "../../lib/panel";
import { updateSettings } from "../../lib/store";
import { vyntricEmbed } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Post the Vyntric Support ticket panel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel to post the panel in (defaults to the current channel)")
        .addChannelTypes(ChannelType.GuildText)
    )
    .addStringOption((option) =>
      option
        .setName("style")
        .setDescription("Panel layout style (default: All Category Buttons)")
        .addChoices(
          { name: "All Category Buttons (Direct Buttons for each category)", value: "buttons" },
          { name: "Tickets v2 Single Button ('Open A Ticket')", value: "v2" },
          { name: "Dropdown (Direct Category Select Menu)", value: "menu" }
        )
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("title")
        .setDescription("Custom panel title (default: Vyntric Support)")
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: "This command only works inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    const target = (interaction.options.getChannel("channel") ?? interaction.channel) as TextChannel | null;
    if (!target || !target.isTextBased()) {
      await interaction.reply({ content: "I cannot post the panel there.", flags: MessageFlags.Ephemeral });
      return;
    }

    const style = interaction.options.getString("style") ?? "buttons";
    const customTitle = interaction.options.getString("title") ?? "Vyntric Support";

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let embed = buildV2PanelEmbed(customTitle);
    let components;

    if (style === "v2") {
      components = buildV2PanelRow("Open A Ticket", "📩");
    } else if (style === "menu") {
      components = buildCategorySelectRow();
    } else {
      // Default: Direct category buttons for all topics!
      components = buildPanelRows();
    }

    const message = await target.send({
      embeds: [embed],
      components,
    });
    await message.pin().catch(() => {});

    updateSettings(interaction.guild.id, {
      panelChannelId: target.id,
      panelMessageId: message.id,
    });

    await interaction.editReply({
      embeds: [
        vyntricEmbed("success")
          .setTitle("✅ Ticket panel published")
          .setDescription(
            [
              `The ticket panel is live in ${target}.`,
              `**Style:** \`${style.toUpperCase()}\``,
              `**Message ID:** \`${message.id}\``,
              "",
              "Buttons available directly on the panel:",
              "• 📩 **General Support**",
              "• 🎁 **Claim Reward**",
              "• 🛡️ **Team Application**",
              "• 🤝 **Partnership**",
              "",
              "-# Configure staff roles and the log channel with `/setup`.",
            ].join("\n")
          ),
      ],
    });
  },
};

export default command;
