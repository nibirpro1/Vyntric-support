import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { Command } from "../../structures/Command";
import { VyntricClient } from "../../structures/VyntricClient";
import { canManageStaff } from "../../lib/permissions";
import { vyntricEmbed, section } from "../../lib/brand";
import { addTrial, listTrials, concludeTrial, TrialStatus, getActiveTrial } from "../../lib/store";

const STATUS_TEXT: Record<TrialStatus, string> = {
  active: "⏳ Active Trial",
  promoted: "🎉 Promoted to Full Staff",
  extended: "⏱️ Trial Extended",
  demoted: "❌ Trial Ended (Not Passed)",
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("trial")
    .setDescription("Vyntric Staff trial period & onboarding management")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Place a new team member on trial")
        .addUserOption((opt) =>
          opt
            .setName("member")
            .setDescription("The user starting the trial")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("role")
            .setDescription("Trial role title (e.g. Trial Moderator, Junior Dev)")
            .setRequired(true)
            .setMaxLength(60)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("duration_days")
            .setDescription("Trial duration in days (default 14)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(90)
        )
        .addStringOption((opt) =>
          opt
            .setName("notes")
            .setDescription("Internal notes or training goals")
            .setRequired(false)
            .setMaxLength(250)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List active staff trials")
        .addStringOption((opt) =>
          opt
            .setName("filter")
            .setDescription("Filter by trial status")
            .setRequired(false)
            .addChoices(
              { name: "Active", value: "active" },
              { name: "Promoted", value: "promoted" },
              { name: "Extended", value: "extended" },
              { name: "Demoted", value: "demoted" },
              { name: "All", value: "all" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("conclude")
        .setDescription("Conclude or update a member's trial")
        .addUserOption((opt) =>
          opt
            .setName("member")
            .setDescription("The staff member on trial")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("decision")
            .setDescription("Final evaluation outcome")
            .setRequired(true)
            .addChoices(
              { name: "Promote to Full Staff", value: "promoted" },
              { name: "Extend Trial Period", value: "extended" },
              { name: "Demote / End Trial", value: "demoted" }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName("notes")
            .setDescription("Feedback or reasoning")
            .setRequired(false)
            .setMaxLength(300)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction, _client: VyntricClient) {
    if (!interaction.guild || !interaction.member) return;
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member || !canManageStaff(member)) {
      await interaction.reply({
        content: "🛡️ Only Vyntric Head Staff / Administrators can manage staff trials.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "add") {
      const targetUser = interaction.options.getUser("member", true);
      const roleName = interaction.options.getString("role", true);
      const durationDays = interaction.options.getInteger("duration_days") || 14;
      const notes = interaction.options.getString("notes") || "Under evaluation.";

      const existing = getActiveTrial(interaction.guild.id, targetUser.id);
      if (existing) {
        await interaction.reply({
          content: `⚠️ <@${targetUser.id}> already has an active trial for **${existing.roleName}** ending on <t:${Math.floor(existing.endDate / 1000)}:R>.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const trial = addTrial({
        guildId: interaction.guild.id,
        userId: targetUser.id,
        username: targetUser.tag,
        roleName,
        durationDays,
        mentorId: interaction.user.id,
        mentorTag: interaction.user.tag,
        notes,
      });

      const embed = vyntricEmbed("accent")
        .setTitle(`🛡️ Staff Trial Started: ${targetUser.username}`)
        .setDescription(
          `${section("Trial Information")}\n` +
            `• **Member:** <@${trial.userId}>\n` +
            `• **Role:** \`${trial.roleName}\`\n` +
            `• **Duration:** ${trial.durationDays} Days\n` +
            `• **Evaluation Period Ends:** <t:${Math.floor(trial.endDate / 1000)}:F> (<t:${Math.floor(trial.endDate / 1000)}:R>)\n` +
            `• **Mentor / Added By:** <@${trial.mentorId}>\n` +
            `• **Goals / Notes:** ${trial.notes}`
        );

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === "list") {
      const filter = interaction.options.getString("filter");
      const statusFilter = filter && filter !== "all" ? (filter as TrialStatus) : undefined;
      const trials = listTrials(interaction.guild.id, statusFilter);

      if (trials.length === 0) {
        await interaction.reply({
          content: "📋 No trial records found matching the filter.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const lines = trials.slice(0, 10).map((t) => {
        const remaining = Math.max(0, Math.ceil((t.endDate - Date.now()) / (1000 * 60 * 60 * 24)));
        const countdown = t.status === "active" ? `(${remaining} days left)` : "";
        return `• <@${t.userId}> — **${t.roleName}** [${STATUS_TEXT[t.status]} ${countdown}]\n↳ Mentor: <@${t.mentorId}> | Started: <t:${Math.floor(t.startDate / 1000)}:d>`;
      });

      const embed = vyntricEmbed("primary")
        .setTitle("📋 Vyntric Staff Trial Roster")
        .setDescription(
          `${section("Staff In Training")}\n` +
            lines.join("\n\n") +
            (trials.length > 10 ? `\n\n_...and ${trials.length - 10} more records._` : "")
        );

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === "conclude") {
      const targetUser = interaction.options.getUser("member", true);
      const decision = interaction.options.getString("decision", true) as "promoted" | "extended" | "demoted";
      const notes = interaction.options.getString("notes") || "Evaluation completed.";

      const trial = concludeTrial(interaction.guild.id, targetUser.id, decision, notes);
      if (!trial) {
        await interaction.reply({
          content: `⚠️ No active trial record found for <@${targetUser.id}>.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const tone = decision === "promoted" ? "success" : decision === "extended" ? "warning" : "danger";
      const embed = vyntricEmbed(tone)
        .setTitle(`🛡️ Trial Evaluation Decision: ${targetUser.username}`)
        .setDescription(
          `${section("Outcome")}\n` +
            `• **Member:** <@${trial.userId}>\n` +
            `• **Role:** \`${trial.roleName}\`\n` +
            `• **Verdict:** **${STATUS_TEXT[trial.status]}**\n` +
            `• **Decided By:** <@${interaction.user.id}>\n` +
            `• **Feedback / Notes:** ${notes}`
        );

      await interaction.reply({ embeds: [embed] });
      return;
    }
  },
};

export default command;
