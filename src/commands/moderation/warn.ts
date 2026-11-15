import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { Command } from "../../structures/Command";
import {
  addPunishment,
  clearUserWarnings,
  listPunishments,
  removePunishment,
} from "../../lib/store";
import { getAutoModConfig } from "../../lib/automodStore";
import { getLoggingConfig } from "../../lib/loggingStore";
import { BRAND } from "../../lib/brand";

function canStaffWarn(member: GuildMember): boolean {
  if (member.id === member.guild.ownerId) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  if (member.permissions.has(PermissionFlagsBits.ModerateMembers)) return true;
  if (member.permissions.has(PermissionFlagsBits.KickMembers)) return true;
  if (member.permissions.has(PermissionFlagsBits.BanMembers)) return true;

  // Key staff roles in Vyntric
  return member.roles.cache.some((r) => {
    const name = r.name.toLowerCase();
    return (
      name.includes("admin") ||
      name.includes("mod") ||
      name.includes("vyntric core") ||
      name.includes("vyntric trial") ||
      name.includes("staff") ||
      name.includes("lead")
    );
  });
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Advanced warning & strike management system for all members")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Issue a formal warning to a member with auto-strike escalation")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("The member to warn").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason for the warning").setRequired(true)
        )
        .addBooleanOption((opt) =>
          opt
            .setName("silent")
            .setDescription("If true, do not send a DM warning to the member")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Pardon and remove a specific warning by Case ID")
        .addStringOption((opt) =>
          opt
            .setName("case_id")
            .setDescription("The Warning Case ID to remove (e.g. pun_...)")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason for removing warning").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("clear")
        .setDescription("Clear all active warnings for a member")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("The member whose warnings will be cleared").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason for clearing warnings").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("View full warning history and strike count for a member")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("The member to check").setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const callerMember = (interaction.member as GuildMember) ||
      (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));

    if (!callerMember || !canStaffWarn(callerMember)) {
      await interaction.reply({
        content: "❌ **Permission Denied:** You must be a Staff member or have Moderate Members permission to use `/warn`.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    // ─────────────────────────────────────────────────────────────
    // 1. WARN ADD
    // ─────────────────────────────────────────────────────────────
    if (sub === "add") {
      const targetUser = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason", true).trim();
      const silent = interaction.options.getBoolean("silent") || false;

      if (targetUser.id === interaction.client.user.id) {
        await interaction.reply({
          content: "❌ I cannot warn myself.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (targetUser.bot) {
        await interaction.reply({
          content: "⚠️ Bots cannot receive formal warnings.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      // Hierarchy check: Non-owners cannot warn owner or higher staff
      if (interaction.guild.ownerId !== interaction.user.id && targetMember) {
        if (targetMember.id === interaction.guild.ownerId) {
          await interaction.reply({
            content: "❌ You cannot warn the server owner.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (targetMember.roles.highest.position >= callerMember.roles.highest.position) {
          await interaction.reply({
            content: "❌ You cannot warn this member because their role is equal to or higher than yours.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }

      const record = addPunishment({
        guildId,
        userId: targetUser.id,
        username: targetUser.tag,
        kind: "warn",
        reason,
        durationDays: null,
        staffId: interaction.user.id,
        staffTag: interaction.user.tag,
      });

      // Calculate active strikes
      const allUserPunishments = listPunishments(guildId, targetUser.id);
      const activeWarnings = allUserPunishments.filter((p) => p.kind === "warn" && !p.liftedAt);
      const strikeCount = activeWarnings.length;

      // Strike Escalation Ladder
      let escalationNote = "None (Strike logged)";
      let timeoutMs = 0;

      if (strikeCount === 2) {
        timeoutMs = 10 * 60 * 1000; // 10 minutes
        escalationNote = "⚠️ **Strike 2 Penalty:** 10-Minute Timeout";
      } else if (strikeCount === 3) {
        timeoutMs = 60 * 60 * 1000; // 1 hour
        escalationNote = "🛑 **Strike 3 Penalty:** 1-Hour Timeout";
      } else if (strikeCount === 4) {
        timeoutMs = 12 * 60 * 60 * 1000; // 12 hours
        escalationNote = "🚨 **Strike 4 Penalty:** 12-Hour Timeout";
      } else if (strikeCount >= 5) {
        timeoutMs = 24 * 60 * 60 * 1000; // 24 hours
        escalationNote = "🔨 **Strike 5+ Severe Penalty:** 24-Hour Timeout (Staff Review for Ban)";
      }

      if (timeoutMs > 0 && targetMember && targetMember.moderatable) {
        try {
          await targetMember.timeout(timeoutMs, `Auto-Escalation: Strike ${strikeCount} - ${reason}`);
        } catch (err: any) {
          console.warn("[warn:timeout:error]", err.message);
        }
      }

      // Try sending a DM notice to warned user
      let dmSent = false;
      if (!silent) {
        try {
          const dmEmbed = new EmbedBuilder()
            .setColor(BRAND.colors.warning)
            .setTitle(`⚠️ Warning Received in ${interaction.guild.name}`)
            .setDescription(
              `You have been issued a formal warning by server moderation.\n\n` +
                `• **Reason:** \`${reason}\`\n` +
                `• **Strike Level:** **Strike ${strikeCount}**\n` +
                `• **Action Taken:** ${escalationNote}\n` +
                `• **Case ID:** \`${record.id}\`\n\n` +
                `*Please respect server rules to prevent further timeouts or a permanent ban.*`
            )
            .setFooter({ text: `${BRAND.name} Moderation` })
            .setTimestamp();

          await targetUser.send({ embeds: [dmEmbed] });
          dmSent = true;
        } catch {}
      }

      const replyEmbed = new EmbedBuilder()
        .setColor(strikeCount >= 3 ? BRAND.colors.danger : BRAND.colors.warning)
        .setTitle(`⚠️ Formal Warning Issued (Strike ${strikeCount})`)
        .setDescription(`**${targetUser.tag}** has received a formal warning.`)
        .addFields(
          { name: "👤 Member", value: `${targetUser} (\`${targetUser.id}\`)`, inline: true },
          { name: "🛡️ Moderator", value: `${interaction.user} (\`${interaction.user.tag}\`)`, inline: true },
          { name: "🆔 Case ID", value: `\`${record.id}\``, inline: true },
          { name: "📝 Reason", value: `\`${reason}\``, inline: false },
          { name: "🛑 Strike Escalation", value: escalationNote, inline: true },
          { name: "📬 DM Notice", value: silent ? "_Silent (Disabled)_" : dmSent ? "✅ Delivered" : "❌ Blocked / Closed DMs", inline: true }
        )
        .setFooter({ text: `${BRAND.name} Moderation • Use /warn list to view history` })
        .setTimestamp();

      await interaction.reply({ embeds: [replyEmbed] });

      // Log to Mod Log / Server Logs channel
      const autoMod = getAutoModConfig(guildId);
      const logsCfg = getLoggingConfig(guildId);
      const logChannelId = autoMod.logChannelId || logsCfg.logChannelId || logsCfg.commandLogChannelId || "1508536272048885853";

      if (logChannelId) {
        const logChannel = interaction.guild.channels.cache.get(logChannelId) as TextChannel | undefined;
        if (logChannel && logChannel.isTextBased()) {
          await logChannel.send({ embeds: [replyEmbed] }).catch(() => {});
        }
      }
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 2. WARN REMOVE (By Case ID)
    // ─────────────────────────────────────────────────────────────
    if (sub === "remove") {
      const caseId = interaction.options.getString("case_id", true).trim();
      const reason = interaction.options.getString("reason") || "Warning pardoned by staff";

      const removed = removePunishment(caseId);
      if (!removed) {
        await interaction.reply({
          content: `❌ No warning record found with Case ID \`${caseId}\`.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.success)
        .setTitle("✅ Warning Removed")
        .setDescription(`Case **\`${caseId}\`** has been successfully removed from member records.`)
        .addFields(
          { name: "Moderator", value: `${interaction.user} (\`${interaction.user.tag}\`)`, inline: true },
          { name: "Reason", value: `\`${reason}\``, inline: true }
        )
        .setFooter({ text: BRAND.footer })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 3. WARN CLEAR (All warnings for a user)
    // ─────────────────────────────────────────────────────────────
    if (sub === "clear") {
      const targetUser = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason") || "All warnings cleared by staff";

      const removedCount = clearUserWarnings(guildId, targetUser.id);
      if (removedCount === 0) {
        await interaction.reply({
          content: `ℹ️ **${targetUser.tag}** has 0 active warnings on record.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.success)
        .setTitle("🧹 Member Warnings Cleared")
        .setDescription(`Successfully cleared **${removedCount}** warning(s) for ${targetUser} (\`${targetUser.tag}\`).`)
        .addFields(
          { name: "Moderator", value: `${interaction.user} (\`${interaction.user.tag}\`)`, inline: true },
          { name: "Reason", value: `\`${reason}\``, inline: true }
        )
        .setFooter({ text: `${BRAND.name} Moderation` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 4. WARN LIST
    // ─────────────────────────────────────────────────────────────
    if (sub === "list") {
      const targetUser = interaction.options.getUser("user", true);
      const punishments = listPunishments(guildId, targetUser.id);
      const warningsOnly = punishments.filter((p) => p.kind === "warn");

      if (warningsOnly.length === 0) {
        await interaction.reply({
          content: `✅ **${targetUser.tag}** has a clean record with **0 warnings**!`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const activeCount = warningsOnly.filter((p) => !p.liftedAt).length;

      const lines = warningsOnly.slice(0, 15).map((p, i) => {
        const status = p.liftedAt ? "~~[PARDONED]~~" : "**[ACTIVE]**";
        return (
          `**${i + 1}.** ${status} \`${p.reason}\`\n` +
          `• Case: \`${p.id}\` • By: <@${p.staffId}> • Date: <t:${Math.floor(p.createdAt / 1000)}:R>`
        );
      });

      const embed = new EmbedBuilder()
        .setColor(activeCount > 0 ? BRAND.colors.warning : BRAND.colors.success)
        .setTitle(`📜 Warning History for ${targetUser.tag}`)
        .setDescription(lines.join("\n\n"))
        .addFields(
          { name: "Active Strikes", value: `**${activeCount}** active strike(s)`, inline: true },
          { name: "Total Warnings Logged", value: `**${warningsOnly.length}** recorded`, inline: true }
        )
        .setFooter({ text: "Use /warn add or /warn remove to manage strikes" })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }
  },
};

export default command;
