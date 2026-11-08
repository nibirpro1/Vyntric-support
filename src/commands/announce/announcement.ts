import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { Command } from "../../structures/Command";
import { vyntricEmbed } from "../../lib/brand";
import {
  AnnouncementInput,
  buildAllowedMentions,
  buildAnnouncementDmComponents,
  buildAnnouncementDmEmbed,
  buildAnnouncementEmbed,
  buildPingContent,
  canPost,
} from "../../lib/announce";
import { runDmBroadcast } from "../../lib/announceDm";
import { getSettings } from "../../lib/store";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("announcement")
    .setDescription("Post a Vyntric announcement and alert members in DM")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option
        .setName("title")
        .setDescription("Announcement headline (e.g. Vyntric)")
        .setRequired(true)
        .setMaxLength(120)
    )
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("Paste the full announcement text here")
        .setRequired(true)
        .setMaxLength(1800)
    )
    .addStringOption((option) =>
      option
        .setName("alert")
        .setDescription("Short DM alert line (e.g. UHC event today at 8:00 PM)")
        .setRequired(false)
        .setMaxLength(200)
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel to announce in (defaults to the current channel)")
        .addChannelTypes(ChannelType.GuildText)
    )
    .addRoleOption((option) =>
      option
        .setName("ping-role")
        .setDescription("Role to ping with the announcement")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("ping")
        .setDescription("Also mention everyone or only online members")
        .setRequired(false)
        .addChoices({ name: "@everyone", value: "everyone" }, { name: "@here", value: "here" })
    )
    .addBooleanOption((option) =>
      option.setName("dm").setDescription("Send the DM alert (default: yes)").setRequired(false)
    )
    .addRoleOption((option) =>
      option
        .setName("dm-role")
        .setDescription("Only DM members holding this role (e.g. Vyntric UHC)")
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: "This command only works inside a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const me = interaction.guild.members.me ?? (await interaction.guild.members.fetchMe());
    const target = (interaction.options.getChannel("channel") ?? interaction.channel) as TextChannel | null;

    if (!target || !target.isTextBased() || !canPost(target, me)) {
      await interaction.reply({
        content: "I cannot post an announcement there — check my channel permissions.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const title = interaction.options.getString("title", true).trim();
    // `\n` typed in the command box becomes a real line break, so multi-line
    // announcements survive Discord's single-line option input.
    const message = interaction.options
      .getString("message", true)
      .trim()
      .replace(/\\n/g, "\n");
    const alert = interaction.options.getString("alert")?.trim().replace(/\\n/g, " ") ?? null;
    const pingRole = interaction.options.getRole("ping-role");
    const ping = interaction.options.getString("ping");
    const dmRole = interaction.options.getRole("dm-role");
    const sendDms = interaction.options.getBoolean("dm") ?? true;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const input: AnnouncementInput = {
      title,
      message,
      alert,
      actorTag: interaction.user.tag,
      pingRoleId: pingRole?.id ?? null,
      jumpUrl: null,
    };

    const announcement = await target.send({
      content: buildPingContent({ ping, pingRoleId: pingRole?.id ?? null }) || undefined,
      embeds: [buildAnnouncementEmbed(input)],
      allowedMentions: buildAllowedMentions({ ping, pingRoleId: pingRole?.id ?? null }),
    });

    input.jumpUrl = announcement.url;

    const startMessage = [
      `**Announcement:** ${announcement.url}`,
      `**Channel:** ${target}`,
      ping === "everyone" ? "**Pinged:** @everyone" : ping === "here" ? "**Pinged:** @here" : null,
      pingRole ? `**Pinged:** <@&${pingRole.id}>` : null,
      alert ? `**Alert line:** ${alert}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    if (!sendDms) {
      await interaction.editReply({
        embeds: [
          vyntricEmbed("success")
            .setTitle("✅ Announcement posted")
            .setDescription(
              [startMessage, "", "-# DM alert was disabled for this announcement."].join("\n")
            ),
        ],
      });
      return;
    }

    await interaction.editReply({
      embeds: [
        vyntricEmbed("accent")
          .setTitle("📨 Sending DM alerts…")
          .setDescription(
            [
              startMessage,
              "",
              dmRole ? `**Audience:** members with <@&${dmRole.id}>` : "**Audience:** every member in the server",
              "-# Sending in small batches to stay inside Discord's limits.",
            ].join("\n")
          ),
      ],
    });

    const dmEmbed = buildAnnouncementDmEmbed(input, interaction.guild, target.name);
    const dmComponents = buildAnnouncementDmComponents(announcement.url);

    await runDmBroadcast(
      interaction,
      dmEmbed,
      dmComponents,
      dmRole?.id ?? null,
      startMessage
    );
  },
};

export default command;
