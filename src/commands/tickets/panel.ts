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
        .setDescription("Panel layout style (default: Tickets v2 Single Button)")
        .addChoices(
          { name: "Tickets v2 (Clean Single Button 'Open A Ticket')", value: "v2" },
          { name: "Dropdown (Direct Category Select Menu)", value: "menu" },
          { name: "Classic (Individual Category Buttons)", value: "buttons" }
        )
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("title")
        .setDescription("Custom panel title (default: Order & General Support)")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("button-label")
        .setDescription("Custom button label (default: Open A Ticket)")
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

    const style = interaction.options.getString("style") ?? "v2";
    const customTitle = interaction.options.getString("title") ?? "Order & General Support";
    const customBtnLabel = interaction.options.getString("button-label") ?? "Open A Ticket";

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let embed;
    let components;

    if (style === "v2") {
      embed = buildV2PanelEmbed(customTitle);
      components = buildV2PanelRow(customBtnLabel, "📩");
    } else if (style === "menu") {
      embed = buildV2PanelEmbed(customTitle);
      components = buildCategorySelectRow();
    } else {
      embed = buildPanelEmbed();
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
              "Members can now click the button to open tickets for:",
              "• **General Support**",
              "• **Order Support**",
              "• **Claim Reward**",
              "• **Team Application**",
              "• **Partnership**",
              "• **Report Player / Bug**",
              "",
              "-# Configure staff roles and the log channel with `/setup`.",
            ].join("\n")
          ),
      ],
    });
  },
};

export default command;
