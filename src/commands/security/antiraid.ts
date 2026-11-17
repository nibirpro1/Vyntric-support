import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { Command } from "../../structures/Command";
import {
  getAntiRaidConfig,
  updateAntiRaidConfig,
} from "../../lib/antiraidStore";
import {
  calculateRiskScore,
  lockdownServer,
  resolveAlertChannel,
  triggerPanicMode,
  unlockdownServer,
} from "../../lib/antiraidManager";
import { BRAND } from "../../lib/brand";
import { hasFeaturePermission } from "../../lib/permissionRolesStore";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("antiraid")
    .setDescription("Enterprise VyntricBD Anti-Raid Shield & High-Velocity Server Defense")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("View live Anti-Raid telemetry, multi-vector status, and lockdown state")
    )
    .addSubcommand((sub) =>
      sub.setName("enable").setDescription("Enable Enterprise Anti-Raid shield protection")
    )
    .addSubcommand((sub) =>
      sub.setName("disable").setDescription("Disable Enterprise Anti-Raid shield protection")
    )
    .addSubcommand((sub) =>
      sub.setName("panic").setDescription("🚨 EMERGENCY: Trigger instant panic mode, hard lockdown, and raider sweep")
    )
    .addSubcommand((sub) =>
      sub.setName("raiders").setDescription("View the complete forensic dossier of accounts from the last raid incident")
    )
    .addSubcommand((sub) =>
      sub
        .setName("risk")
        .setDescription("Perform a real-time heuristic security risk audit on any member")
        .addUserOption((opt) => opt.setName("user").setDescription("The member to inspect").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("sweep")
        .setDescription("Bulk action on all raider accounts captured in the last incident")
        .addStringOption((opt) =>
          opt
            .setName("action")
            .setDescription("Remediation action to execute across all wave raiders")
            .addChoices(
              { name: "⏳ Re-apply 24h Timeout", value: "timeout" },
              { name: "🔓 Lift Timeout (Untimeout All)", value: "untimeout" }
            )
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("lockdown")
        .setDescription("Trigger or release an emergency server-wide lockdown")
        .addStringOption((opt) =>
          opt
            .setName("action")
            .setDescription("Lockdown action")
            .addChoices(
              { name: "🔒 Lock Server (Restrict public chats & threads)", value: "lock" },
              { name: "🔓 Unlock Server (Restore normal chat)", value: "unlock" }
            )
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("mode")
            .setDescription("Lockdown mode intensity (default: hard)")
            .addChoices(
              { name: "🛡️ Hard Lockdown (Mutes chat, threads & reactions)", value: "hard" },
              { name: "⚠️ Soft Lockdown (Mutes chat only)", value: "soft" }
            )
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason for emergency lockdown").setRequired(false)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("duration")
            .setDescription("Lockdown duration in minutes (default: 15 mins)")
            .setMinValue(1)
            .setMaxValue(1440)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("config")
        .setDescription("Configure multi-vector thresholds, risk scoring, and auto-defense policies")
        .addIntegerOption((opt) =>
          opt
            .setName("threshold")
            .setDescription("Max joins allowed in window before triggering raid alert (e.g. 5)")
            .setMinValue(2)
            .setMaxValue(30)
            .setRequired(false)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("window")
            .setDescription("Sliding window in seconds (e.g. 10s)")
            .setMinValue(3)
            .setMaxValue(60)
            .setRequired(false)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("risk-threshold")
            .setDescription("Risk score (0-100) that triggers automatic isolation upon join (e.g. 60)")
            .setMinValue(20)
            .setMaxValue(95)
            .setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt
            .setName("auto-revoke-invite")
            .setDescription("Automatically delete/revoke the invite code used by raiders")
            .setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt
            .setName("auto-lockdown")
            .setDescription("Automatically lock public channels when raid is detected")
            .setRequired(false)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("timeout-minutes")
            .setDescription("Timeout duration in minutes for raiders (default: 60)")
            .setMinValue(1)
            .setMaxValue(10080)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("logs")
        .setDescription("Set dedicated channel for anti-raid emergency alerts")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to dispatch raid alerts")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName("whitelist")
        .setDescription("Manage trusted users or roles immune from anti-raid filters")
        .addSubcommand((sub) =>
          sub
            .setName("add")
            .setDescription("Add an exempt user or role")
            .addUserOption((opt) => opt.setName("user").setDescription("User to whitelist").setRequired(false))
            .addRoleOption((opt) => opt.setName("role").setDescription("Role to whitelist").setRequired(false))
        )
        .addSubcommand((sub) =>
          sub
            .setName("remove")
            .setDescription("Remove an exempt user or role")
            .addUserOption((opt) => opt.setName("user").setDescription("User to remove").setRequired(false))
            .addRoleOption((opt) => opt.setName("role").setDescription("Role to remove").setRequired(false))
        )
        .addSubcommand((sub) =>
          sub.setName("list").setDescription("List all whitelisted users and roles")
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.member) return;

    const member =
      interaction.guild.members.cache.get(interaction.user.id) ||
      (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));

    if (
      !member ||
      (!member.permissions.has(PermissionFlagsBits.Administrator) &&
        !member.permissions.has(PermissionFlagsBits.ManageGuild) &&
        !hasFeaturePermission(member, "security"))
    ) {
      await interaction.reply({
        content: "❌ You need **Administrator**, **Manage Server**, or **🔐 Security Perms** to use Anti-Raid controls.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup(false);
    const guild = interaction.guild;

    // ─────────────────────────────────────────────────────────────
    // 1. STATUS & TELEMETRY
    // ─────────────────────────────────────────────────────────────
    if (sub === "status") {
      const cfg = getAntiRaidConfig(guild.id);
      const alertCh = resolveAlertChannel(guild, cfg);

      const statusIcon = cfg.enabled ? "🟢 **ENABLED & ENTERPRISE ACTIVE**" : "🔴 **DISABLED**";
      const lockdownStatus = cfg.activeLockdown
        ? `🔒 **ACTIVE LOCKDOWN [${cfg.activeLockdown.mode.toUpperCase()}]** (${cfg.activeLockdown.channelsLocked.length} channels locked)\n` +
          `• Started: <t:${Math.floor(cfg.activeLockdown.startedAt / 1000)}:R>\n` +
          (cfg.activeLockdown.expiresAt
            ? `• Auto-Lift: <t:${Math.floor(cfg.activeLockdown.expiresAt / 1000)}:R>\n`
            : "") +
          `• Reason: \`${cfg.activeLockdown.reason || "Manual Lockdown"}\``
        : "🔓 **Server Normal (No active lockdown)**";

      const lastRaid = cfg.lastIncident
        ? `• **Incident ID:** \`${cfg.lastIncident.id}\` (<t:${Math.floor(cfg.lastIncident.timestamp / 1000)}:R>)\n` +
          `• **Vector:** \`${cfg.lastIncident.type.toUpperCase()}\` • **Raiders Contained:** **${cfg.lastIncident.raiderCount} accounts**\n` +
          (cfg.lastIncident.inviteCode ? `• **Compromised Invite:** \`discord.gg/${cfg.lastIncident.inviteCode}\`\n` : "") +
          `• Use \`/antiraid raiders\` to view full account list.`
        : "_No raid attacks recorded yet._";

      const embed = new EmbedBuilder()
        .setColor(cfg.enabled ? BRAND.colors.success : BRAND.colors.danger)
        .setTitle(`🛡️ ${BRAND.name} Enterprise Anti-Raid Shield Telemetry`)
        .setDescription(
          `**Shield System:** ${statusIcon}\n` +
            `**Server Lockdown:** ${lockdownStatus}\n\n` +
            `${BRAND.divider}\n\n` +
            `### ⚡ Enterprise Multi-Vector Defenses\n` +
            `• **Velocity Spike Gate:** **${cfg.joinRaid.threshold} joins** in **${cfg.joinRaid.windowSeconds}s**\n` +
            `• **Heuristic Risk Engine:** ${cfg.riskScoring.enabled ? `✅ Auto-isolates accounts with Score ≥ **${cfg.riskScoring.quarantineThreshold}/100**` : "❌ Disabled"}\n` +
            `• **Name Similarity Clustering:** ${cfg.nameSimilarity.enabled ? `✅ Triggers at **${cfg.nameSimilarity.threshold} similar names** (Ratio: ${cfg.nameSimilarity.similarityRatio})` : "❌ Disabled"}\n` +
            `• **Default-Avatar Wave Guard:** ${cfg.defaultAvatarGate.enabled ? `✅ Triggers at **${cfg.defaultAvatarGate.burstCount} default avatars / window**` : "❌ Disabled"}\n` +
            `• **Invite Leak Defense:** ${cfg.inviteTracking.autoRevokeRaidInvite ? "✅ Auto-Revokes Compromised Raid Invites" : "❌ Disabled"}\n` +
            `• **Cross-Channel Copypasta:** ${cfg.crossChannelSpam.enabled ? "✅ Blocks identical text across channels" : "❌ Disabled"}\n` +
            `• **Auto-Lockdown:** ${cfg.joinRaid.autoLockdown ? `✅ Yes (${cfg.joinRaid.autoLockdownMinutes}m ${cfg.joinRaid.lockdownMode.toUpperCase()})` : "❌ Disabled"}\n\n` +
            `### 🚨 Last Incident Forensic Brief\n${lastRaid}\n\n` +
            `• **Alert Channel:** ${alertCh ? `<#${alertCh.id}>` : "_Auto-resolving security channels_"}\n` +
            `• **Whitelisted Users:** ${cfg.whitelistedUsers.length > 0 ? cfg.whitelistedUsers.map((id) => `<@${id}>`).join(", ") : "_None_"}\n` +
            `• **Whitelisted Roles:** ${cfg.whitelistedRoles.length > 0 ? cfg.whitelistedRoles.map((id) => `<@&${id}>`).join(", ") : "_None_"}`
        )
        .setFooter({ text: `${BRAND.footer} • Server Defense Shield` })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("antiraid:toggle")
          .setLabel(cfg.enabled ? "Disable Shield" : "Enable Shield")
          .setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(cfg.activeLockdown ? "antiraid:unlock" : "antiraid:lock")
          .setLabel(cfg.activeLockdown ? "🔓 Lift Lockdown" : "🔒 Hard Lockdown")
          .setStyle(cfg.activeLockdown ? ButtonStyle.Success : ButtonStyle.Danger)
      );

      await interaction.reply({ embeds: [embed], components: [row] });
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 2. PANIC PROTOCOL
    // ─────────────────────────────────────────────────────────────
    if (sub === "panic") {
      await interaction.deferReply();
      const res = await triggerPanicMode(guild, interaction.user.tag);
      await interaction.editReply({
        content: `🚨 **PANIC MODE ENGAGED:**\n• **Hard Lockdown:** Active across **${res.channelsLocked} channels**.\n• **Raider Sweep:** Quarantined **${res.raidersSwept} recent joiners** in 1h timeout.`,
      });
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 3. RAIDERS DOSSIER
    // ─────────────────────────────────────────────────────────────
    if (sub === "raiders") {
      const cfg = getAntiRaidConfig(guild.id);
      if (!cfg.lastIncident || cfg.lastIncident.raiders.length === 0) {
        await interaction.reply({
          content: "ℹ️ No recent raid incident or raider accounts recorded in this server.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const incident = cfg.lastIncident;
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.danger)
        .setTitle(`📋 Raiders Forensic Dossier: Incident #${incident.id}`)
        .setDescription(
          `• **Timestamp:** <t:${Math.floor(incident.timestamp / 1000)}:F> (<t:${Math.floor(incident.timestamp / 1000)}:R>)\n` +
            `• **Attack Vector:** \`${incident.type.toUpperCase()}\`\n` +
            `• **Velocity:** **${incident.velocity}**\n` +
            (incident.inviteCode ? `• **Compromised Invite:** \`discord.gg/${incident.inviteCode}\`\n` : "") +
            `• **Total Accounts:** **${incident.raiderCount} raiders**\n\n` +
            `### Identified Raider Accounts:\n` +
            incident.raiders
              .slice(0, 20)
              .map(
                (r, i) =>
                  `\`${i + 1}.\` <@${r.userId}> (\`${r.userTag}\` | \`${r.userId}\`)\n` +
                  `   • Risk: **${r.riskScore}/100** • Created <t:${Math.floor(r.createdAt / 1000)}:R>` +
                  (r.inviteCode ? ` • via \`${r.inviteCode}\`` : "") +
                  ` • Status: ${r.timedOut ? "⏳ Timed Out" : "Normal"}`
              )
              .join("\n") +
            (incident.raiders.length > 20 ? `\n...and **${incident.raiders.length - 20} more accounts**` : "")
        )
        .setFooter({ text: `${BRAND.footer} • Raid Remediation` })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("antiraid:sweep_timeout")
          .setLabel("🧹 Re-Apply 24h Timeout to All")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("antiraid:unlock")
          .setLabel("🔓 Lift Server Lockdown")
          .setStyle(ButtonStyle.Success)
      );

      await interaction.reply({ embeds: [embed], components: [row] });
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 4. RISK AUDIT
    // ─────────────────────────────────────────────────────────────
    if (sub === "risk") {
      const targetUser = interaction.options.getUser("user", true);
      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

      if (!targetMember) {
        await interaction.reply({
          content: "❌ User is not currently a member of this server.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const risk = calculateRiskScore(targetMember);
      const color =
        risk.level === "CRITICAL"
          ? BRAND.colors.danger
          : risk.level === "HIGH"
          ? BRAND.colors.warning
          : risk.level === "MEDIUM"
          ? BRAND.colors.gold
          : BRAND.colors.success;

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`🔍 Heuristic Security Risk Audit: ${targetUser.tag}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setDescription(
          `• **Member:** <@${targetUser.id}> (\`${targetUser.id}\`)\n` +
            `• **Account Age:** <t:${Math.floor(targetUser.createdTimestamp / 1000)}:R> (<t:${Math.floor(targetUser.createdTimestamp / 1000)}:f>)\n` +
            `• **Joined Server:** ${targetMember.joinedTimestamp ? `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:R>` : "_Unknown_"}\n` +
            `• **Security Risk Score:** **${risk.score}/100** [**${risk.level}**]\n\n` +
            `### Evaluation Factors:\n` +
            (risk.factors.length > 0 ? risk.factors.map((f) => `• ${f}`).join("\n") : "• Account displays clean metrics. No risk flags triggered.")
        )
        .setFooter({ text: `${BRAND.footer} • Security Telemetry` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 5. SWEEP (BULK REMEDIATION)
    // ─────────────────────────────────────────────────────────────
    if (sub === "sweep") {
      const action = interaction.options.getString("action", true);
      const cfg = getAntiRaidConfig(guild.id);
      const raiders = cfg.lastIncident?.raiders || [];

      if (raiders.length === 0) {
        await interaction.reply({
          content: "⚠️ No raider accounts found in the last incident record.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferReply();
      let modified = 0;

      for (const r of raiders) {
        try {
          const m = await guild.members.fetch(r.userId).catch(() => null);
          if (m) {
            if (action === "timeout") {
              await m.timeout(24 * 3600_000, `[VyntricBD Raid Sweep] 24h timeout by ${interaction.user.tag}`);
              r.timedOut = true;
              modified++;
            } else if (action === "untimeout") {
              await m.timeout(null, `[VyntricBD Raid Sweep] Untimeout by ${interaction.user.tag}`);
              r.timedOut = false;
              modified++;
            }
          }
        } catch {}
      }

      updateAntiRaidConfig(guild.id, (prev) => ({ ...prev }));

      await interaction.editReply({
        content: `✅ **Sweep Action Completed:** Successfully updated **${modified} / ${raiders.length} raiders** with action \`${action.toUpperCase()}\`.`,
      });
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 6. ENABLE / DISABLE
    // ─────────────────────────────────────────────────────────────
    if (sub === "enable") {
      updateAntiRaidConfig(guild.id, (prev) => ({ ...prev, enabled: true }));
      await interaction.reply({
        content: `✅ **VyntricBD Enterprise Anti-Raid Shield is now ACTIVE!**\nHeuristic risk scoring, velocity gates, invite leak defenses, and auto-lockdowns are operational.`,
      });
      return;
    }

    if (sub === "disable") {
      updateAntiRaidConfig(guild.id, (prev) => ({ ...prev, enabled: false }));
      await interaction.reply({
        content: `⚠️ **VyntricBD Enterprise Anti-Raid Shield has been DEACTIVATED.**`,
      });
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 7. LOCKDOWN
    // ─────────────────────────────────────────────────────────────
    if (sub === "lockdown") {
      const action = interaction.options.getString("action", true);
      const mode = (interaction.options.getString("mode") as any) || "hard";
      const reason = interaction.options.getString("reason") || "Manual Administrator Emergency Lockdown";
      const duration = interaction.options.getInteger("duration") || 15;

      await interaction.deferReply();

      if (action === "lock") {
        const res = await lockdownServer(guild, reason, interaction.user.tag, duration, mode);
        await interaction.editReply({
          content: `🔒 **Emergency ${mode.toUpperCase()} Lockdown Activated!**\nRestricted \`SendMessages\` and threads on **${res.channelsLocked.length} public channels** for **${duration} minutes**.\nReason: *${reason}*`,
        });
      } else {
        const res = await unlockdownServer(guild, interaction.user.tag);
        await interaction.editReply({
          content: `🔓 **Server Lockdown Lifted!**\nRestored \`SendMessages\` across **${res.channelsRestored} channels**.`,
        });
      }
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 8. CONFIG
    // ─────────────────────────────────────────────────────────────
    if (sub === "config") {
      const threshold = interaction.options.getInteger("threshold");
      const window = interaction.options.getInteger("window");
      const riskThreshold = interaction.options.getInteger("risk-threshold");
      const autoRevoke = interaction.options.getBoolean("auto-revoke-invite");
      const autoLockdown = interaction.options.getBoolean("auto-lockdown");
      const timeoutMinutes = interaction.options.getInteger("timeout-minutes");

      const next = updateAntiRaidConfig(guild.id, (prev) => {
        const updated = { ...prev };
        if (threshold !== null) updated.joinRaid.threshold = threshold;
        if (window !== null) updated.joinRaid.windowSeconds = window;
        if (riskThreshold !== null) updated.riskScoring.quarantineThreshold = riskThreshold;
        if (autoRevoke !== null) updated.inviteTracking.autoRevokeRaidInvite = autoRevoke;
        if (autoLockdown !== null) updated.joinRaid.autoLockdown = autoLockdown;
        if (timeoutMinutes !== null) updated.joinRaid.timeoutMinutes = timeoutMinutes;
        return updated;
      });

      await interaction.reply({
        content:
          `⚙️ **Enterprise Anti-Raid Configuration Updated:**\n` +
          `• **Join Velocity:** ${next.joinRaid.threshold} joins / ${next.joinRaid.windowSeconds}s\n` +
          `• **Risk Score Isolation Threshold:** ${next.riskScoring.quarantineThreshold}/100\n` +
          `• **Auto-Revoke Compromised Invites:** ${next.inviteTracking.autoRevokeRaidInvite ? "Enabled" : "Disabled"}\n` +
          `• **Auto-Lockdown:** ${next.joinRaid.autoLockdown ? "Enabled" : "Disabled"}\n` +
          `• **Timeout Duration:** ${next.joinRaid.timeoutMinutes} minutes`,
      });
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 9. LOGS
    // ─────────────────────────────────────────────────────────────
    if (sub === "logs") {
      const channel = interaction.options.getChannel("channel", true) as TextChannel;
      updateAntiRaidConfig(guild.id, (prev) => ({ ...prev, logChannelId: channel.id }));
      await interaction.reply({
        content: `✅ Anti-Raid security alerts will now be dispatched to <#${channel.id}>.`,
      });
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 10. WHITELIST
    // ─────────────────────────────────────────────────────────────
    if (group === "whitelist") {
      if (sub === "add") {
        const user = interaction.options.getUser("user");
        const role = interaction.options.getRole("role");

        if (!user && !role) {
          await interaction.reply({
            content: "⚠️ Please specify either a **user** or a **role** to whitelist.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        updateAntiRaidConfig(guild.id, (prev) => {
          const u = new Set(prev.whitelistedUsers);
          const r = new Set(prev.whitelistedRoles);
          if (user) u.add(user.id);
          if (role) r.add(role.id);
          return {
            ...prev,
            whitelistedUsers: Array.from(u),
            whitelistedRoles: Array.from(r),
          };
        });

        await interaction.reply({
          content: `✅ Added ${user ? `<@${user.id}> ` : ""}${role ? `<@&${role.id}> ` : ""}to Anti-Raid whitelist.`,
        });
        return;
      }

      if (sub === "remove") {
        const user = interaction.options.getUser("user");
        const role = interaction.options.getRole("role");

        updateAntiRaidConfig(guild.id, (prev) => {
          const u = prev.whitelistedUsers.filter((id) => id !== user?.id);
          const r = prev.whitelistedRoles.filter((id) => id !== role?.id);
          return {
            ...prev,
            whitelistedUsers: u,
            whitelistedRoles: r,
          };
        });

        await interaction.reply({
          content: `✅ Removed from Anti-Raid whitelist.`,
        });
        return;
      }

      if (sub === "list") {
        const cfg = getAntiRaidConfig(guild.id);
        const usersList =
          cfg.whitelistedUsers.length > 0
            ? cfg.whitelistedUsers.map((id) => `<@${id}>`).join(", ")
            : "_None_";
        const rolesList =
          cfg.whitelistedRoles.length > 0
            ? cfg.whitelistedRoles.map((id) => `<@&${id}>`).join(", ")
            : "_None_";

        await interaction.reply({
          content: `📋 **Anti-Raid Whitelist:**\n• **Users:** ${usersList}\n• **Roles:** ${rolesList}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }
  },
};

export default command;
