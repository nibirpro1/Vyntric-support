import {
  ChannelType,
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { Command } from "../../structures/Command";
import { buildPanelEmbed, buildPanelRows } from "../../lib/panel";
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

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const message = await target.send({
      embeds: [buildPanelEmbed()],
      components: buildPanelRows(),
    });
    await message.pin().catch(() => {});

    updateSettings(interaction.guild.id, {
      panelChannelId: target.id,
      panelMessageId: message.id,
    });

    await interaction.editReply({
      embeds: [
        vyntricEmbed("success")
          .setTitle("✅ Vyntric panel published")
          .setDescription(
            [
              `The ticket panel is live in ${target}.`,
              `**Message:** \`${message.id}\``,
              "",
              "Members can now open **Claim Reward**, **Team Application** and **Partnership** tickets.",
              "-# Configure staff roles and the log channel with `/setup`.",
            ].join("\n")
          ),
      ],
    });
  },
};

export default command;
