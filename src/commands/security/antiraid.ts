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
  lockdownServer,
  resolveAlertChannel,
  unlockdownServer,
} from "../../lib/antiraidManager";
import { BRAND } from "../../lib/brand";
import { hasFeaturePermission } from "../../lib/permissionRolesStore";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("antiraid")
    .setDescription("Configure VyntricBD Anti-Raid Shield & Server Defense System")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("View current Anti-Raid shield status and active defenses")
    )
    .addSubcommand((sub) =>
      sub.setName("enable").setDescription("Enable Anti-Raid shield protection")
    )
    .addSubcommand((sub) =>
      sub.setName("disable").setDescription("Disable Anti-Raid shield protection")
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
              { name: "🔒 Lock Server (Restrict public chats)", value: "lock" },
              { name: "🔓 Unlock Server (Restore normal chat)", value: "unlock" }
            )
            .setRequired(true)
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
        .setDescription("Configure join threshold, account age gate, and lockdown policies")
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
            .setName("min-age-days")
            .setDescription("Minimum account age in days (younger accounts flagged/timed out, e.g. 3)")
            .setMinValue(0)
            .setMaxValue(30)
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

    // Check permissions: Administrator, ManageGuild, or Security Perm Role
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
    // 1. STATUS / SETTINGS
    // ─────────────────────────────────────────────────────────────
    if (sub === "status") {
      const cfg = getAntiRaidConfig(guild.id);
      const alertCh = resolveAlertChannel(guild, cfg);

      const statusIcon = cfg.enabled ? "🟢 **ENABLED & SHIELD ACTIVE**" : "🔴 **DISABLED**";
      const lockdownStatus = cfg.activeLockdown
        ? `🔒 **ACTIVE LOCKDOWN** (${cfg.activeLockdown.channelsLocked.length} channels locked)\n` +
          `• Started: <t:${Math.floor(cfg.activeLockdown.startedAt / 1000)}:R>\n` +
          (cfg.activeLockdown.expiresAt
            ? `• Unlocks: <t:${Math.floor(cfg.activeLockdown.expiresAt / 1000)}:R>\n`
            : "") +
          `• Reason: \`${cfg.activeLockdown.reason || "Manual Lockdown"}\``
        : "🔓 **Server Normal (No active lockdown)**";

      const embed = new EmbedBuilder()
        .setColor(cfg.enabled ? BRAND.colors.success : BRAND.colors.danger)
        .setTitle(`🛡️ ${BRAND.name} Anti-Raid Shield Status`)
        .setDescription(
          `**Shield System:** ${statusIcon}\n` +
            `**Server Lockdown:** ${lockdownStatus}\n\n` +
            `${BRAND.divider}\n\n` +
            `### ⚡ Active Defense Parameters\n` +
            `• **Mass Join Detection:** **${cfg.joinRaid.threshold} joins** within **${cfg.joinRaid.windowSeconds}s**\n` +
            `• **Join Raid Action:** **${cfg.joinRaid.action.toUpperCase()}** for **${cfg.joinRaid.timeoutMinutes}m**\n` +
            `• **Auto-Lockdown on Raid:** ${cfg.joinRaid.autoLockdown ? `✅ Yes (${cfg.joinRaid.autoLockdownMinutes}m)` : "❌ Disabled"}\n` +
            `• **Account Age Gate:** ${cfg.accountAgeGate.enabled ? `✅ Minimum **${cfg.accountAgeGate.minAgeDays} days**` : "❌ Disabled"}\n` +
            `• **Anti-Mention Raid:** ${cfg.antiMentionRaid.enabled ? `✅ Max **${cfg.antiMentionRaid.maxMentions} mentions**` : "❌ Disabled"}\n` +
            `• **Anti-Spam Flood:** ${cfg.antiSpamRaid.enabled ? `✅ Max **${cfg.antiSpamRaid.maxMessages} msgs / ${cfg.antiSpamRaid.windowSeconds}s**` : "❌ Disabled"}\n\n` +
            `### 📢 Alerts & Exemptions\n` +
            `• **Alert Channel:** ${alertCh ? `<#${alertCh.id}>` : "_None configured (using auto-detection)_"}\n` +
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
          .setLabel(cfg.activeLockdown ? "🔓 Lift Lockdown" : "🔒 Emergency Lockdown")
          .setStyle(cfg.activeLockdown ? ButtonStyle.Success : ButtonStyle.Danger)
      );

      await interaction.reply({ embeds: [embed], components: [row] });
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 2. ENABLE / DISABLE
    // ─────────────────────────────────────────────────────────────
    if (sub === "enable") {
      updateAntiRaidConfig(guild.id, (prev) => ({ ...prev, enabled: true }));
      await interaction.reply({
        content: `✅ **VyntricBD Anti-Raid Shield is now ACTIVE!**\nMass-join detection, young account gating, and auto-lockdown are fully operational.`,
      });
      return;
    }

    if (sub === "disable") {
      updateAntiRaidConfig(guild.id, (prev) => ({ ...prev, enabled: false }));
      await interaction.reply({
        content: `⚠️ **VyntricBD Anti-Raid Shield has been DEACTIVATED.**\nAutomated raid interception and mass-join locks are now paused.`,
      });
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 3. LOCKDOWN (MANUAL EMERGENCY)
    // ─────────────────────────────────────────────────────────────
    if (sub === "lockdown") {
      const action = interaction.options.getString("action", true);
      const reason = interaction.options.getString("reason") || "Manual Administrator Emergency Lockdown";
      const duration = interaction.options.getInteger("duration") || 15;

      await interaction.deferReply();

      if (action === "lock") {
        const res = await lockdownServer(guild, reason, interaction.user.tag, duration);
        await interaction.editReply({
          content: `🔒 **Emergency Lockdown Activated!**\nRestricted \`SendMessages\` on **${res.channelsLocked.length} public channels** for **${duration} minutes**.\nReason: *${reason}*`,
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
    // 4. CONFIG
    // ─────────────────────────────────────────────────────────────
    if (sub === "config") {
      const threshold = interaction.options.getInteger("threshold");
      const window = interaction.options.getInteger("window");
      const minAgeDays = interaction.options.getInteger("min-age-days");
      const autoLockdown = interaction.options.getBoolean("auto-lockdown");
      const timeoutMinutes = interaction.options.getInteger("timeout-minutes");

      const next = updateAntiRaidConfig(guild.id, (prev) => {
        const updated = { ...prev };
        if (threshold !== null) updated.joinRaid.threshold = threshold;
        if (window !== null) updated.joinRaid.windowSeconds = window;
        if (minAgeDays !== null) updated.accountAgeGate.minAgeDays = minAgeDays;
        if (autoLockdown !== null) updated.joinRaid.autoLockdown = autoLockdown;
        if (timeoutMinutes !== null) updated.joinRaid.timeoutMinutes = timeoutMinutes;
        return updated;
      });

      await interaction.reply({
        content:
          `⚙️ **Anti-Raid Configuration Updated:**\n` +
          `• **Join Threshold:** ${next.joinRaid.threshold} joins / ${next.joinRaid.windowSeconds}s\n` +
          `• **Min Account Age:** ${next.accountAgeGate.minAgeDays} days\n` +
          `• **Auto-Lockdown:** ${next.joinRaid.autoLockdown ? "Enabled" : "Disabled"}\n` +
          `• **Timeout Duration:** ${next.joinRaid.timeoutMinutes} minutes`,
      });
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 5. LOGS
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
    // 6. WHITELIST
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
