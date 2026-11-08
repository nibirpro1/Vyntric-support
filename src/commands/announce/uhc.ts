import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { Command } from "../../structures/Command";
import { vyntricEmbed } from "../../lib/brand";
import { buildAllowedMentions, buildPingContent, canPost } from "../../lib/announce";
import { runDmBroadcast } from "../../lib/announceDm";
import { getSettings } from "../../lib/store";
import { UHC_DEFAULTS, UhcEventInput, buildUhcDmEmbed, buildUhcEmbed } from "../../lib/uhc";

const TEAMS = ["Solo", "Duo", "Trio", "Squad"];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("uhc")
    .setDescription("Post the full Vyntric UHC announcement and alert members in DM")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption((option) =>
      option
        .setName("preview")
        .setDescription("Only show it to me, do not post it (default: no)")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("time")
        .setDescription("Event time (default: the server event time)")
        .setRequired(false)
        .setMaxLength(60)
    )
    .addStringOption((option) =>
      option
        .setName("border")
        .setDescription(`World border (default: ${UHC_DEFAULTS.border})`)
        .setRequired(false)
        .setMaxLength(40)
    )
    .addStringOption((option) =>
      option
        .setName("version")
        .setDescription(`Minecraft version (default: ${UHC_DEFAULTS.version})`)
        .setRequired(false)
        .setMaxLength(20)
    )
    .addStringOption((option) =>
      option
        .setName("team")
        .setDescription("Team limit (default: Squad)")
        .setRequired(false)
        .addChoices(...TEAMS.map((team) => ({ name: team, value: team })))
    )
    .addStringOption((option) =>
      option
        .setName("ip")
        .setDescription(`Server IP (default: ${UHC_DEFAULTS.ip})`)
        .setRequired(false)
        .setMaxLength(120)
    )
    .addStringOption((option) =>
      option
        .setName("prize")
        .setDescription("Prize pool line (optional)")
        .setRequired(false)
        .setMaxLength(300)
    )
    .addStringOption((option) =>
      option
        .setName("features")
        .setDescription("Feature sections — use \\n for line breaks (Kits, Revive, Supply Drop...)")
        .setRequired(false)
        .setMaxLength(1000)
    )
    .addStringOption((option) =>
      option
        .setName("extra")
        .setDescription("Anything else members must know — use \\n for line breaks")
        .setRequired(false)
        .setMaxLength(1000)
    )
    .addStringOption((option) =>
      option
        .setName("mace")
        .setDescription("Mace setting (default: ban)")
        .setRequired(false)
        .addChoices(
          { name: "🚫 Ban Mace", value: "ban" },
          { name: "✅ Allow Mace", value: "allow" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("cart")
        .setDescription("TNT Minecart setting (e.g. 'ban', 'allow', 'max 3')")
        .setRequired(false)
        .setMaxLength(60)
    )
    .addStringOption((option) =>
      option
        .setName("banned")
        .setDescription("Additional banned items/enchants (comma-separated)")
        .setRequired(false)
        .setMaxLength(300)
    )
    .addStringOption((option) =>
      option
        .setName("allowed")
        .setDescription("Additional allowed items/enchants (comma-separated)")
        .setRequired(false)
        .setMaxLength(300)
    )
    .addChannelOption((option) =>
      option
        .setName("announcementchannel")
        .setDescription("Channel to post announcement in (defaults to current)")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Alias for announcement channel")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addRoleOption((option) =>
      option.setName("ping-role").setDescription("Role to ping with the announcement").setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("ping")
        .setDescription("Also mention everyone or only online members")
        .setRequired(false)
        .addChoices({ name: "@everyone", value: "everyone" }, { name: "@here", value: "here" })
    )
    .addBooleanOption((option) =>
      option.setName("dm").setDescription("Send the DM alert to members (default: yes)").setRequired(false)
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

    const settings = getSettings(interaction.guild.id);
    const clean = (key: string) =>
      interaction.options.getString(key)?.trim().replace(/\\n/g, "\n") ?? null;

    const input: UhcEventInput = {
      title: UHC_DEFAULTS.title,
      time: clean("time") ?? settings.eventTime ?? UHC_DEFAULTS.schedule,
      border: clean("border") ?? UHC_DEFAULTS.border,
      version: clean("version") ?? UHC_DEFAULTS.version,
      team: interaction.options.getString("team") ?? UHC_DEFAULTS.team,
      ip: clean("ip") ?? process.env.UHC_SERVER_IP ?? UHC_DEFAULTS.ip,
      prize: clean("prize"),
      features: clean("features"),
      extra: clean("extra"),
      mace: interaction.options.getString("mace") ?? "ban",
      cart: clean("cart"),
      customBanned: clean("banned"),
      customAllowed: clean("allowed"),
    };

    if (interaction.options.getBoolean("preview") ?? false) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: "👀 **Preview only** — nothing was posted and no DM was sent.",
        embeds: [buildUhcEmbed(input)],
      });
      return;
    }

    const me = interaction.guild.members.me ?? (await interaction.guild.members.fetchMe());
    const target = (interaction.options.getChannel("announcementchannel") ??
      interaction.options.getChannel("channel") ??
      interaction.channel) as TextChannel | null;

    if (!target || !target.isTextBased() || !canPost(target, me)) {
      await interaction.reply({
        content: "I cannot post there — check my channel permissions.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const pingRole = interaction.options.getRole("ping-role");
    const ping = interaction.options.getString("ping");
    const dmRole = interaction.options.getRole("dm-role");
    const sendDms = interaction.options.getBoolean("dm") ?? true;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const announcement = await target.send({
      content: buildPingContent({ ping, pingRoleId: pingRole?.id ?? null }) || undefined,
      embeds: [buildUhcEmbed(input)],
      allowedMentions: buildAllowedMentions({ ping, pingRoleId: pingRole?.id ?? null }),
    });

    const startMessage = [
      `**Announcement:** ${announcement.url}`,
      `**Channel:** ${target}`,
      `**Time:** ${input.time} • **Team:** ${input.team} • **IP:** \`${input.ip}\``,
      ping === "everyone" ? "**Pinged:** @everyone" : ping === "here" ? "**Pinged:** @here" : null,
      pingRole ? `**Pinged:** <@&${pingRole.id}>` : null,
    ]
      .filter(Boolean)
      .join("\n");

    if (!sendDms) {
      await interaction.editReply({
        embeds: [
          vyntricEmbed("success")
            .setTitle("✅ UHC announcement posted")
            .setDescription([startMessage, "", "-# DM alert was disabled."].join("\n")),
        ],
      });
      return;
    }

    await interaction.editReply({
      embeds: [
        vyntricEmbed("accent")
          .setTitle("📨 Sending UHC alerts in DM…")
          .setDescription(
            [
              startMessage,
              "",
              dmRole ? `**Audience:** members with <@&${dmRole.id}>` : "**Audience:** every member",
            ].join("\n")
          ),
      ],
    });

    await runDmBroadcast(
      interaction,
      buildUhcDmEmbed(input, interaction.guild.name, announcement.url),
      dmRole?.id ?? null,
      startMessage
    );
  },
};

export default command;
