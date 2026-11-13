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
import {
  getBroadcastCooldownRemaining,
  isBroadcastActive,
  runDmBroadcast,
} from "../../lib/announceDm";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("announcement")
    .setDescription("Post a Vyntric announcement and alert members in DM (sent once per member)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option
        .setName("title")
        .setDescription("Announcement headline / title")
        .setRequired(true)
        .setMaxLength(256)
    )
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("Full announcement text (use \\n for line breaks, markdown supported)")
        .setRequired(true)
        .setMaxLength(4000)
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel to announce in (defaults to current channel)")
        .addChannelTypes(ChannelType.GuildText)
    )
    .addStringOption((option) =>
      option
        .setName("button")
        .setDescription("DM button text (e.g. 'Join Giveaway'). Leave empty for clean embed with no button.")
        .setRequired(false)
        .setMaxLength(80)
    )
    .addStringOption((option) =>
      option
        .setName("color")
        .setDescription("Embed left border color (defaults to Vyntric Red)")
        .setRequired(false)
        .addChoices(
          { name: "Vyntric Red (Default)", value: "#b1121f" },
          { name: "Crimson Accent", value: "#e23a4e" },
          { name: "Emerald Green", value: "#2fbf71" },
          { name: "Gold Yellow", value: "#f2c14e" },
          { name: "Royal Blue", value: "#3a86ff" },
          { name: "Purple", value: "#8338ec" },
          { name: "Discord Dark", value: "#2b2d31" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("image")
        .setDescription("Banner image URL to show at bottom of the embed")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("thumbnail")
        .setDescription("Thumbnail: type 'server' for server icon, a URL, or 'none'")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("footer")
        .setDescription("Custom footer text at the bottom of the embed")
        .setRequired(false)
        .setMaxLength(200)
    )
    .addStringOption((option) =>
      option
        .setName("button-url")
        .setDescription("Custom link for the DM button (defaults to announcement link)")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("dm-style")
        .setDescription("DM look: 'exact' (clean matching embed) or 'notice' (card with header)")
        .setRequired(false)
        .addChoices(
          { name: "Exact Match (Clean Red Embed)", value: "exact" },
          { name: "Notice Card Style", value: "notice" }
        )
    )
    .addBooleanOption((option) =>
      option
        .setName("dm")
        .setDescription("Send DM alert to members? (Default: true)")
        .setRequired(false)
    )
    .addRoleOption((option) =>
      option
        .setName("dm-role")
        .setDescription("Only DM members holding this role (e.g. Giveaway Role)")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("ping")
        .setDescription("Mention @everyone or @here in the channel announcement")
        .setRequired(false)
        .addChoices({ name: "@everyone", value: "everyone" }, { name: "@here", value: "here" })
    )
    .addRoleOption((option) =>
      option
        .setName("ping-role")
        .setDescription("Role to ping in the channel announcement")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("alert")
        .setDescription("Optional short alert note line")
        .setRequired(false)
        .setMaxLength(200)
    )
    .addBooleanOption((option) =>
      option
        .setName("preview")
        .setDescription("Preview only: see how it looks without posting or sending DMs")
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

    const guildId = interaction.guild.id;

    // 1. Guard against overlapping server-wide broadcasts
    if (isBroadcastActive(guildId)) {
      await interaction.reply({
        content:
          "⚠️ **A server-wide DM broadcast is currently in progress!**\n" +
          "Please wait until it finishes before sending another announcement to prevent duplicate alerts.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // 2. Cooldown guard (prevents rapid duplicate triggers)
    const cooldown = getBroadcastCooldownRemaining(guildId, 30);
    if (cooldown > 0) {
      await interaction.reply({
        content:
          `⏳ **Announcement cooldown active.**\n` +
          `An announcement was recently sent. Please wait **${cooldown}s** before broadcasting another one to prevent spamming members.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const me = interaction.guild.members.me ?? (await interaction.guild.members.fetchMe());
    const channelOption = interaction.options.getChannel("channel");
    const target = (channelOption ?? interaction.channel) as TextChannel | null;

    if (!target || !target.isTextBased() || !canPost(target, me)) {
      await interaction.reply({
        content: "I cannot post an announcement there — check my channel permissions (ViewChannel, SendMessages, EmbedLinks).",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const title = interaction.options.getString("title", true).trim();
    const message = interaction.options
      .getString("message", true)
      .trim()
      .replace(/\\n/g, "\n");
    const alert = interaction.options.getString("alert")?.trim().replace(/\\n/g, " ") ?? null;
    const pingRole = interaction.options.getRole("ping-role");
    const ping = interaction.options.getString("ping");
    const dmRole = interaction.options.getRole("dm-role");
    const sendDms = interaction.options.getBoolean("dm") ?? true;
    const previewMode = interaction.options.getBoolean("preview") ?? false;
    const color = interaction.options.getString("color")?.trim() ?? null;
    const button = interaction.options.getString("button")?.trim() ?? null;
    const buttonUrl = interaction.options.getString("button-url")?.trim() ?? null;
    const image = interaction.options.getString("image")?.trim() ?? null;
    const thumbnail = interaction.options.getString("thumbnail")?.trim() ?? null;
    const footer = interaction.options.getString("footer")?.trim() ?? null;
    const dmStyle = (interaction.options.getString("dm-style") as "exact" | "notice" | null) ?? "exact";

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const input: AnnouncementInput = {
      title,
      message,
      alert,
      actorTag: interaction.user.tag,
      pingRoleId: pingRole?.id ?? null,
      jumpUrl: null,
      color,
      image,
      thumbnail,
      footer,
      buttonLabel: button,
      buttonUrl,
      dmStyle,
    };

    const channelEmbed = buildAnnouncementEmbed(input, interaction.guild);
    const dmEmbedPreview = buildAnnouncementDmEmbed(input, interaction.guild, target.name);
    const dmComponentsPreview = buildAnnouncementDmComponents(input, "https://discord.com");

    const isDefaultChannel = !channelOption;
    const channelWarning = isDefaultChannel
      ? ` ⚠️ *(Notice: No channel was selected, defaulting to <#${target.id}>)*`
      : "";

    const summaryText = [
      `📢 **Target Channel:** <#${target.id}>${channelWarning}`,
      ping === "everyone" ? "🔔 **Ping:** `@everyone`" : ping === "here" ? "🔔 **Ping:** `@here`" : pingRole ? `🔔 **Ping:** <@&${pingRole.id}>` : "🔔 **Ping:** None",
      `🎨 **Embed Color:** \`${color || "#b1121f (Vyntric Red)"}\``,
      sendDms
        ? dmRole
          ? `📨 **DM Broadcast:** Members with role <@&${dmRole.id}> (Sent 1 time per member)`
          : "📨 **DM Broadcast:** **Every server member** (Sent 1 time per member)"
        : "📨 **DM Broadcast:** **Disabled** (Channel only)",
      `✨ **DM Style:** \`${dmStyle === "notice" ? "Notice Card Style" : "Exact Match (Clean Red Embed)"}\``,
      button ? `🔘 **DM Button:** \`[ ${button} ]\`` : "🔘 **DM Button:** None (Clean embed)",
      image ? `🖼️ **Banner Image:** ${image}` : null,
      thumbnail ? `🖼️ **Thumbnail:** ${thumbnail}` : null,
      footer ? `📝 **Footer:** ${footer}` : null,
      alert ? `💬 **DM Alert text:** ${alert}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    // ─────────────────────────────────────────────────────────────
    // PREVIEW ONLY MODE
    // ─────────────────────────────────────────────────────────────
    if (previewMode) {
      await interaction.editReply({
        content: `🔍 **Announcement Preview Mode** (Nothing has been posted or sent)\n\n${summaryText}\n\n_Embed 1: Channel appearance | Embed 2: Member DM appearance_`,
        embeds: [channelEmbed, dmEmbedPreview],
        components: dmComponentsPreview ? dmComponentsPreview : [],
      });
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // DIRECT PUBLISH (Immediate & deduplicated)
    // ─────────────────────────────────────────────────────────────
    const announcement = await target.send({
      content: buildPingContent({ ping, pingRoleId: pingRole?.id ?? null }) || undefined,
      embeds: [channelEmbed],
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
              "-# Each member receives exactly 1 DM notice (protected against duplicates).",
            ].join("\n")
          ),
      ],
    });

    const dmEmbed = buildAnnouncementDmEmbed(input, interaction.guild, target.name);
    const dmComponents = buildAnnouncementDmComponents(input, announcement.url);

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
