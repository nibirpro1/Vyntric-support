import { ChatInputCommandInteraction, GuildMember, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, ChannelType } from "discord.js";
import { Command } from "../../structures/Command";
import { section, vyntricEmbed } from "../../lib/brand";
import { TICKET_TYPES } from "../../config/tickets";
import { getSettings, listTickets, resetSettings, updateSettings } from "../../lib/store";
import { padTicketNumber } from "../../lib/permissions";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configure the Vyntric Support ticket system")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName("view").setDescription("Show the current Vyntric configuration"))
    .addSubcommand((sub) =>
      sub
        .setName("staff-role")
        .setDescription("Add or remove a role that can manage tickets")
        .addRoleOption((option) => option.setName("role").setDescription("Role").setRequired(true))
        .addStringOption((option) =>
          option
            .setName("action")
            .setDescription("Add or remove (default: add)")
            .addChoices({ name: "add", value: "add" }, { name: "remove", value: "remove" })
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("log-channel")
        .setDescription("Channel that receives ticket logs and transcripts")
        .addChannelOption((option) =>
          option.setName("channel").setDescription("Log channel").setRequired(true).addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("category")
        .setDescription("Category new tickets are created in")
        .addChannelOption((option) =>
          option.setName("category").setDescription("Ticket category").setRequired(true).addChannelTypes(ChannelType.GuildCategory)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("archive-category")
        .setDescription("Category closed tickets are moved to")
        .addChannelOption((option) =>
          option.setName("category").setDescription("Archive category").setRequired(true).addChannelTypes(ChannelType.GuildCategory)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("feedback-channel")
        .setDescription("Channel that receives 1-5 star reviews")
        .addChannelOption((option) =>
          option.setName("channel").setDescription("Review channel").setRequired(true).addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("results-channel")
        .setDescription("Channel that receives Vyntric Tiers test-result embeds")
        .addChannelOption((option) =>
          option.setName("channel").setDescription("Results channel").setRequired(true).addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("ping-staff")
        .setDescription("Ping the staff roles when a new ticket opens")
        .addBooleanOption((option) => option.setName("enabled").setDescription("Enabled?").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("dm-transcript")
        .setDescription("DM the requester the transcript and rating buttons on close")
        .addBooleanOption((option) => option.setName("enabled").setDescription("Enabled?").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("auto-archive")
        .setDescription("Move closed tickets to the archive category")
        .addBooleanOption((option) => option.setName("enabled").setDescription("Enabled?").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("event-time")
        .setDescription("Standard event time used in announcements and DM alerts")
        .addStringOption((option) =>
          option
            .setName("time")
            .setDescription("e.g. 9:00 PM (daily)")
            .setRequired(true)
            .setMaxLength(80)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("tier-channel")
        .setDescription("Point one of the Vyntric Tiers feeds at a channel")
        .addStringOption((option) =>
          option
            .setName("feed")
            .setDescription("Which feed")
            .setRequired(true)
            .addChoices(
              { name: "🏆 Tier results", value: "results" },
              { name: "🧪 High test requests", value: "high-tests" },
              { name: "📊 High test results", value: "high-results" },
              { name: "⛔ Punishments", value: "punishments" },
              { name: "🔁 Staff movements", value: "staff-movements" },
              { name: "📮 Appeals", value: "appeals" }
            )
        )
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Channel for that feed")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((sub) => sub.setName("reset").setDescription("Reset every Vyntric setting for this server"))
    .addSubcommand((sub) => sub.setName("stats").setDescription("Ticket statistics for this server")),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: "This command only works inside a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const guild = interaction.guild;
    const sub = interaction.options.getSubcommand();
    const settings = getSettings(guild.id);
    const ok = (title: string, description: string) => ({
      embeds: [vyntricEmbed("success").setTitle(title).setDescription(description)],
      flags: MessageFlags.Ephemeral as const,
    });

    if (sub === "view") {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [
          vyntricEmbed("primary")
            .setTitle("⚙️ Vyntric Support Configuration")
            .setDescription(
              [
                section("Ticket system"),
                `**Staff roles:** ${
                  settings.staffRoleIds.length
                    ? settings.staffRoleIds.map((id) => `<@&${id}>`).join(", ")
                    : "⚠️ none yet — only Manage Server members can help"
                }`,
                `**Log channel:** ${settings.logChannelId ? `<#${settings.logChannelId}>` : "⚠️ not set"}`,
                `**Ticket category:** ${settings.categoryId ? `<#${settings.categoryId}>` : "*auto-created*"}`,
                `**Archive category:** ${settings.archiveCategoryId ? `<#${settings.archiveCategoryId}>` : "*auto-created*"}`,
                `**Feedback channel:** ${settings.feedbackChannelId ? `<#${settings.feedbackChannelId}>` : "*disabled*"}`,
                section("Vyntric Tiers"),
                `**Tier results:** ${settings.resultsChannelId ? `<#${settings.resultsChannelId}>` : "*not set*"}`,
                `**High tests:** ${settings.highTestsChannelId ? `<#${settings.highTestsChannelId}>` : "*not set*"}`,
                `**High results:** ${settings.highResultsChannelId ? `<#${settings.highResultsChannelId}>` : "*not set*"}`,
                `**Punishments:** ${settings.punishmentsChannelId ? `<#${settings.punishmentsChannelId}>` : "*not set*"}`,
                `**Staff movements:** ${settings.staffLogChannelId ? `<#${settings.staffLogChannelId}>` : "*not set*"}`,
                `**Appeals:** ${settings.appealsChannelId ? `<#${settings.appealsChannelId}>` : "*not set*"}`,
                `**Staff roles:** ${Object.values(settings.tierRoleIds ?? {}).flat().length ? Object.values(settings.tierRoleIds).flat().map((id) => `<@&${id}>`).join(", ") : "*run /tester setup*"}`,
                "",
                section("Behaviour"),
                `**Ping staff:** ${settings.pingStaff ? "✅" : "❌"}`,
                `**DM transcript + rating:** ${settings.dmTranscript ? "✅" : "❌"}`,
                `**Auto archive closed tickets:** ${settings.autoArchive ? "✅" : "❌"}`,
                `**Event time:** \`${settings.eventTime}\``,
                "",
                section("Ticket types"),
                TICKET_TYPES.map((type) => `${type.emoji} \`${type.id}\` — ${type.label}`).join("\n"),
                "",
                `**Tickets opened so far:** \`${settings.ticketCounter}\``,
              ].join("\n")
            ),
        ],
      });
      return;
    }

    if (sub === "stats") {
      const all = listTickets(guild.id);
      const open = all.filter((ticket) => ticket.status === "open");
      const closed = all.filter((ticket) => ticket.status === "closed");
      const rated = closed.filter((ticket) => typeof ticket.rating === "number");
      const average = rated.length
        ? (rated.reduce((sum, ticket) => sum + (ticket.rating ?? 0), 0) / rated.length).toFixed(2)
        : "n/a";

      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [
          vyntricEmbed("accent")
            .setTitle("📊 Vyntric Ticket Statistics")
            .setDescription(
              [
                `**Total tickets:** \`${all.length}\``,
                `**Open:** \`${open.length}\``,
                `**Closed:** \`${closed.length}\``,
                `**Average rating:** \`${average}\` (${rated.length} review(s))`,
                "",
                TICKET_TYPES.map((type) => {
                  const count = all.filter((ticket) => ticket.type === type.id).length;
                  return `${type.emoji} **${type.label}:** \`${count}\``;
                }).join("\n"),
              ].join("\n")
            ),
        ],
      });
      return;
    }

    if (sub === "tier-channel") {
      const feed = interaction.options.getString("feed", true);
      const channel = interaction.options.getChannel("channel", true);
      const patch: Record<string, string> = {
        results: "resultsChannelId",
        "high-tests": "highTestsChannelId",
        "high-results": "highResultsChannelId",
        punishments: "punishmentsChannelId",
        "staff-movements": "staffLogChannelId",
        appeals: "appealsChannelId",
      };
      updateSettings(guild.id, { [patch[feed]]: channel.id });
      await interaction.reply(
        ok("📡 Tier Feed Set", `**${feed}** now posts into ${channel}.`)
      );
      return;
    }
    if (sub === "reset") {
      resetSettings(guild.id);
      await interaction.reply(
        ok(
          "🧹 Configuration Reset",
          "Every Vyntric setting for this server was cleared. Tickets and transcripts were kept."
        )
      );
      return;
    }

    if (sub === "staff-role") {
      const role = interaction.options.getRole("role", true);
      const action = interaction.options.getString("action") ?? "add";
      const roles = new Set(settings.staffRoleIds);

      if (action === "add") roles.add(role.id);
      else roles.delete(role.id);

      updateSettings(guild.id, { staffRoleIds: [...roles] });

      await interaction.reply(
        ok(
          action === "add" ? "✅ Staff Role Added" : "➖ Staff Role Removed",
          `${role} ${action === "add" ? "can now see and manage" : "can no longer manage"} tickets.\n-# Current staff roles: ${
            [...roles].map((id) => `<@&${id}>`).join(", ") || "none"
          }`
        )
      );
      return;
    }

    if (sub === "log-channel") {
      const channel = interaction.options.getChannel("channel", true);
      updateSettings(guild.id, { logChannelId: channel.id });
      await interaction.reply(
        ok("📄 Log Channel Set", `Ticket logs and transcripts now go to <#${channel.id}>.`)
      );
      return;
    }

    if (sub === "category") {
      const category = interaction.options.getChannel("category", true);
      updateSettings(guild.id, { categoryId: category.id });
      await interaction.reply(
        ok("📁 Ticket Category Set", `New tickets are now created inside **${category.name}**.`)
      );
      return;
    }

    if (sub === "archive-category") {
      const category = interaction.options.getChannel("category", true);
      updateSettings(guild.id, { archiveCategoryId: category.id });
      await interaction.reply(
        ok("🗄️ Archive Category Set", `Closed tickets are moved into **${category.name}**.`)
      );
      return;
    }

    if (sub === "feedback-channel") {
      const channel = interaction.options.getChannel("channel", true);
      updateSettings(guild.id, { feedbackChannelId: channel.id });
      await interaction.reply(
        ok("⭐ Feedback Channel Set", `1-5 star reviews are posted in <#${channel.id}>.`)
      );
      return;
    }

    if (sub === "results-channel") {
      const channel = interaction.options.getChannel("channel", true);
      updateSettings(guild.id, { resultsChannelId: channel.id });
      await interaction.reply(
        ok("🏆 Results Channel Set", `Tier test results are now posted in <#${channel.id}>.`)
      );
      return;
    }

    if (sub === "ping-staff") {
      const enabled = interaction.options.getBoolean("enabled", true);
      updateSettings(guild.id, { pingStaff: enabled });
      await interaction.reply(
        ok(
          "🔔 Staff Ping Updated",
          enabled
            ? "Staff roles are pinged whenever a ticket opens."
            : "Staff roles are no longer pinged on new tickets."
        )
      );
      return;
    }

    if (sub === "dm-transcript") {
      const enabled = interaction.options.getBoolean("enabled", true);
      updateSettings(guild.id, { dmTranscript: enabled });
      await interaction.reply(
        ok(
          "📬 DM Transcript Updated",
          enabled
            ? "Members receive the transcript, a close summary and the rating buttons in DM."
            : "Members no longer receive ticket DMs."
        )
      );
      return;
    }

    if (sub === "auto-archive") {
      const enabled = interaction.options.getBoolean("enabled", true);
      updateSettings(guild.id, { autoArchive: enabled });
      await interaction.reply(
        ok(
          "🗄️ Auto Archive Updated",
          enabled
            ? "Closed tickets are moved to the archive category."
            : "Closed tickets stay where they are."
        )
      );
      return;
    }

    if (sub === "event-time") {
      const time = interaction.options.getString("time", true).trim();
      updateSettings(guild.id, { eventTime: time });
      await interaction.reply(
        ok(
          "⏰ Event Time Updated",
          [
            `Standard event time is now **${time}**.`,
            "",
            "Every `/announcement` now shows it in the channel post and in the member DM alert.",
          ].join("\n")
        )
      );
      return;
    }

  },
};

export default command;
