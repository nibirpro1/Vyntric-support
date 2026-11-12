import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ComponentType,
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
    .setDescription("Post a Vyntric announcement with preview & optional member DM broadcast")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option
        .setName("title")
        .setDescription("Announcement headline (e.g. Vyntric UHC Tournament)")
        .setRequired(true)
        .setMaxLength(120)
    )
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("Paste the full announcement text here (use \\n for line breaks)")
        .setRequired(true)
        .setMaxLength(1800)
    )
    .addStringOption((option) =>
      option
        .setName("alert")
        .setDescription("Short DM alert line (e.g. Join the UHC tournament today!)")
        .setRequired(false)
        .setMaxLength(200)
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel to announce in (defaults to current channel)")
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
      option
        .setName("dm")
        .setDescription("Send the DM alert (default: yes)")
        .setRequired(false)
    )
    .addRoleOption((option) =>
      option
        .setName("dm-role")
        .setDescription("Only DM members holding this role (e.g. Giveaway Role)")
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName("preview")
        .setDescription("Preview mode only: see how it looks without posting (default: false)")
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
    const cooldown = getBroadcastCooldownRemaining(guildId, 25);
    if (cooldown > 0) {
      await interaction.reply({
        content:
          `⏳ **Announcement cooldown active.**\n` +
          `An announcement was recently sent. Please wait **${cooldown}s** before broadcasting another one.`,
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

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const input: AnnouncementInput = {
      title,
      message,
      alert,
      actorTag: interaction.user.tag,
      pingRoleId: pingRole?.id ?? null,
      jumpUrl: null,
    };

    const channelEmbed = buildAnnouncementEmbed(input);
    const dmEmbedPreview = buildAnnouncementDmEmbed(input, interaction.guild, target.name);

    const isDefaultChannel = !channelOption;
    const channelWarning = isDefaultChannel
      ? ` ⚠️ *(Notice: No channel was selected, defaulting to <#${target.id}>)*`
      : "";

    const summaryText = [
      `📢 **Target Channel:** <#${target.id}>${channelWarning}`,
      ping === "everyone" ? "🔔 **Ping:** `@everyone`" : ping === "here" ? "🔔 **Ping:** `@here`" : pingRole ? `🔔 **Ping:** <@&${pingRole.id}>` : "🔔 **Ping:** None",
      sendDms
        ? dmRole
          ? `📨 **DM Broadcast:** Members with role <@&${dmRole.id}>`
          : "📨 **DM Broadcast:** **Every server member**"
        : "📨 **DM Broadcast:** **Disabled** (Channel only)",
      alert ? `💬 **DM Alert text:** ${alert}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    // ─────────────────────────────────────────────────────────────
    // PREVIEW ONLY MODE
    // ─────────────────────────────────────────────────────────────
    if (previewMode) {
      await interaction.editReply({
        content: `🔍 **Announcement Preview Mode** (Nothing has been posted or sent)\n\n${summaryText}\n\n_Embeds shown below:_`,
        embeds: [channelEmbed, dmEmbedPreview],
        components: [],
      });
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // INTERACTIVE CONFIRMATION (Prevents accidental duplicate sends)
    // ─────────────────────────────────────────────────────────────
    const confirmId = `annc_post_${interaction.id}`;
    const cancelId = `annc_cancel_${interaction.id}`;

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(confirmId)
        .setLabel("Post Announcement")
        .setEmoji("📢")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(cancelId)
        .setLabel("Cancel")
        .setEmoji("✖️")
        .setStyle(ButtonStyle.Danger)
    );

    const promptMessage = await interaction.editReply({
      content:
        `📢 **Announcement Confirmation & Preview**\n` +
        `Please review the settings and preview below. Click **Post Announcement** to publish, or **Cancel** to abort.\n\n` +
        `${summaryText}\n\n` +
        `_Channel Embed Preview (first) & Member DM Preview (second):_`,
      embeds: [channelEmbed, dmEmbedPreview],
      components: [actionRow],
    });

    let confirmation;
    try {
      confirmation = await promptMessage.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (btn) => btn.user.id === interaction.user.id && (btn.customId === confirmId || btn.customId === cancelId),
        time: 60_000,
      });
    } catch {
      // Timed out after 60s
      await interaction.editReply({
        content: "⌛ **Announcement timed out.** No action was taken and nothing was posted.",
        embeds: [],
        components: [],
      }).catch(() => {});
      return;
    }

    if (confirmation.customId === cancelId) {
      await confirmation.update({
        content: "❌ **Announcement cancelled.** Nothing was posted to the server or DMs.",
        embeds: [],
        components: [],
      });
      return;
    }

    // Re-verify broadcast lock at moment of button click
    if (isBroadcastActive(guildId)) {
      await confirmation.update({
        content: "⚠️ **Another broadcast started while reviewing!** Announcement aborted to avoid duplication.",
        embeds: [],
        components: [],
      });
      return;
    }

    await confirmation.update({
      content: "📨 **Publishing announcement to channel…**",
      embeds: [],
      components: [],
    });

    // ─────────────────────────────────────────────────────────────
    // POST TO CHANNEL
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
        content: null,
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
      content: null,
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
