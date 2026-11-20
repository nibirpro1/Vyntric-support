import {
  ChannelType,
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
  AntiNukePunishment,
  getAntiNukeConfig,
  updateAntiNukeConfig,
} from "../../lib/antinukeStore";
import { hasFeaturePermission } from "../../lib/permissionRolesStore";
import { BRAND } from "../../lib/brand";
import {
  syncWhitelistAdd,
  syncWhitelistRemove,
  syncWhitelistClear,
} from "../../lib/universalWhitelist";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("antinuke")
    .setDescription("Configure Krypton-style Anti-Nuke & Server Security System")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub.setName("enable").setDescription("Enable Anti-Nuke shield protection")
    )
    .addSubcommand((sub) =>
      sub.setName("disable").setDescription("Disable Anti-Nuke shield protection")
    )
    .addSubcommand((sub) =>
      sub.setName("settings").setDescription("View current Anti-Nuke configuration & active modules")
    )
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Quick setup wizard: enable protection, set log channel, and default thresholds")
        .addChannelOption((opt) =>
          opt
            .setName("log-channel")
            .setDescription("Security alert channel for anti-nuke logs")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName("punishment")
            .setDescription("Punishment executed when rate limit is breached (default: ban)")
            .addChoices(
              { name: "🔨 Ban (Highest Security)", value: "ban" },
              { name: "👢 Kick", value: "kick" },
              { name: "⚠️ Quarantine (Strip all Admin/Mod roles)", value: "quarantine" }
            )
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("punishment")
        .setDescription("Set the default punishment for anti-nuke violations")
        .addStringOption((opt) =>
          opt
            .setName("action")
            .setDescription("Action to take on offending accounts")
            .addChoices(
              { name: "🔨 Ban (Highest Security - Default)", value: "ban" },
              { name: "👢 Kick", value: "kick" },
              { name: "⚠️ Quarantine (Strip all Admin/Mod roles)", value: "quarantine" }
            )
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("logs")
        .setDescription("Set the dedicated anti-nuke security alert channel")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Text channel to send high-priority security alerts")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName("whitelist")
        .setDescription("Manage trusted users and roles exempt from anti-nuke triggers")
        .addSubcommand((sub) =>
          sub
            .setName("add")
            .setDescription("Add a trusted user or role to the anti-nuke whitelist")
            .addUserOption((opt) =>
              opt.setName("user").setDescription("User to whitelist").setRequired(false)
            )
            .addRoleOption((opt) =>
              opt.setName("role").setDescription("Role to whitelist").setRequired(false)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("remove")
            .setDescription("Remove a user or role from the anti-nuke whitelist")
            .addUserOption((opt) =>
              opt.setName("user").setDescription("User to remove from whitelist").setRequired(false)
            )
            .addRoleOption((opt) =>
              opt.setName("role").setDescription("Role to remove from whitelist").setRequired(false)
            )
        )
        .addSubcommand((sub) =>
          sub.setName("list").setDescription("List all whitelisted users and roles")
        )
        .addSubcommand((sub) =>
          sub
            .setName("clear")
            .setDescription("Clear whitelisted users, roles, or all from the whitelist")
            .addStringOption((opt) =>
              opt
                .setName("type")
                .setDescription("Target category to clear")
                .setRequired(true)
                .addChoices(
                  { name: "👥 Whitelisted Users Only", value: "users" },
                  { name: "🛡️ Whitelisted Roles Only", value: "roles" },
                  { name: "💥 All (Users & Roles)", value: "all" }
                )
            )
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName("extraowner")
        .setDescription("Manage extra owners with full immunity and management rights")
        .addSubcommand((sub) =>
          sub
            .setName("add")
            .setDescription("Add an extra owner (Server Owner & Extra Owners only)")
            .addUserOption((opt) =>
              opt.setName("user").setDescription("The user to add as extra owner").setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("remove")
            .setDescription("Remove an extra owner")
            .addUserOption((opt) =>
              opt.setName("user").setDescription("The extra owner to remove").setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub.setName("list").setDescription("List all configured extra owners")
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const guildId = interaction.guild.id;
    const config = getAntiNukeConfig(guildId);
    const userId = interaction.user.id;

    const member =
      interaction.member instanceof GuildMember
        ? interaction.member
        : await interaction.guild.members.fetch(userId).catch(() => null);

    // Security check: Only Server Owner, Extra Owners, or staff with Security role
    const isAuthorized =
      interaction.guild.ownerId === userId ||
      config.extraOwners.includes(userId) ||
      (member ? hasFeaturePermission(member, "security") : false);

    if (!isAuthorized) {
      await interaction.reply({
        content:
          "⛔ **Access Denied:** Only the **Server Owner**, configured **Extra Owners**, or staff with the **`🔐 Security Perms`** role have permission to configure Anti-Nuke security.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();

    // ─────────────────────────────────────────────────────────────
    // WHITELIST SUBCOMMANDS
    // ─────────────────────────────────────────────────────────────
    if (group === "whitelist") {
      if (sub === "add") {
        const user = interaction.options.getUser("user");
        const role = interaction.options.getRole("role");

        if (!user && !role) {
          await interaction.reply({
            content:
              "⚠️ **Missing Target:** Please specify either a **user** (`user:@User`) or a **role** (`role:@Role`) to add to the Anti-Nuke whitelist.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const changes: string[] = [];
        let newUsers = [...config.whitelistedUsers];
        let newRoles = [...config.whitelistedRoles];

        if (user) {
          if (newUsers.includes(user.id)) {
            changes.push(`ℹ️ <@${user.id}> is already on the Universal Whitelist.`);
          } else {
            newUsers.push(user.id);
            changes.push(`✅ Added user <@${user.id}> (\`${user.tag}\`) to the **Universal Whitelist**.\n• Full Immunity: AntiNuke, AntiRaid, AutoMod (Links/Invites/Bad Words/Spam), and Moderation protection.`);
          }
        }

        if (role) {
          if (role.id === interaction.guild.id) {
            changes.push(`⚠️ Cannot whitelist the \`@everyone\` role.`);
          } else if (newRoles.includes(role.id)) {
            changes.push(`ℹ️ <@&${role.id}> is already on the Universal Whitelist.`);
          } else {
            newRoles.push(role.id);
            changes.push(`✅ Added role <@&${role.id}> (\`${role.name}\`) to the **Universal Whitelist**.\n• All members with this role now bypass AntiNuke, AntiRaid, and AutoMod.`);
          }
        }

        // 3-Way Atomic Synchronization across AntiNuke, AntiRaid, and AutoMod
        syncWhitelistAdd(guildId, { userId: user?.id, roleId: role?.id });

        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.success)
          .setTitle("🛡️ Universal Whitelist Updated (Full Bypass)")
          .setDescription(changes.join("\n\n"))
          .addFields({
            name: "⚡ 100% Full Bypass Active",
            value: "Whitelisted users and roles now bypass **all bot systems** (Anti-Nuke, Anti-Raid, AutoMod filters, and cannot be moderated or warned).",
          })
          .setFooter({
            text: `${BRAND.name} Security Shield • Universal Immunity Active`,
          })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        return;
      }

      if (sub === "remove") {
        const user = interaction.options.getUser("user");
        const role = interaction.options.getRole("role");

        if (!user && !role) {
          await interaction.reply({
            content:
              "⚠️ **Missing Target:** Please specify either a **user** (`user:@User`) or a **role** (`role:@Role`) to remove from the whitelist.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const changes: string[] = [];
        let newUsers = [...config.whitelistedUsers];
        let newRoles = [...config.whitelistedRoles];

        if (user) {
          if (!newUsers.includes(user.id)) {
            changes.push(`⚠️ User <@${user.id}> is not in the whitelist.`);
          } else {
            changes.push(`✅ Removed user <@${user.id}> from the **Universal Whitelist**.`);
          }
        }

        if (role) {
          if (!newRoles.includes(role.id)) {
            changes.push(`⚠️ Role <@&${role.id}> is not in the whitelist.`);
          } else {
            changes.push(`✅ Removed role <@&${role.id}> from the **Universal Whitelist**.`);
          }
        }

        // 3-Way Atomic Removal across AntiNuke, AntiRaid, and AutoMod
        syncWhitelistRemove(guildId, { userId: user?.id, roleId: role?.id });

        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.primary)
          .setTitle("🛡️ Universal Whitelist Updated")
          .setDescription(changes.join("\n\n"))
          .setFooter({ text: `${BRAND.name} Security Shield` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        return;
      }

      if (sub === "list") {
        const latestConfig = getAntiNukeConfig(guildId);
        const usersList =
          latestConfig.whitelistedUsers.length > 0
            ? latestConfig.whitelistedUsers.map((id) => `• <@${id}> (\`${id}\`)`).join("\n")
            : "_No whitelisted users configured._";

        const rolesList =
          latestConfig.whitelistedRoles.length > 0
            ? latestConfig.whitelistedRoles.map((id) => `• <@&${id}> (\`${id}\`)`).join("\n")
            : "_No whitelisted roles configured._";

        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.primary)
          .setTitle("🛡️ Universal Immunity & Whitelist")
          .setDescription(
            "Users and members holding whitelisted roles bypass **ALL bot features and restrictions**:\n" +
            "• **Anti-Nuke Shield:** Exempt from all mass action rate-limits and bot addition penalties.\n" +
            "• **AutoMod:** 100% bypass for links, invites, bad words, attachments, spam, and mentions.\n" +
            "• **Anti-Raid:** Unrestricted join gates, account age checks, and avatar locks.\n" +
            "• **Staff Commands:** Protected against `/warn`, `/timeout`, `/kick`, and `/ban`.\n" +
            "• **Permissions:** Full access to all bot features."
          )
          .addFields(
            {
              name: `👥 Whitelisted Users (${latestConfig.whitelistedUsers.length})`,
              value: usersList,
              inline: false,
            },
            {
              name: `🛡️ Whitelisted Roles (${latestConfig.whitelistedRoles.length})`,
              value: rolesList,
              inline: false,
            }
          )
          .setFooter({
            text: `${BRAND.name} Security Shield • Server Owner & Extra Owners are always immune`,
          })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        return;
      }

      if (sub === "clear") {
        const type = interaction.options.getString("type", true) as "users" | "roles" | "all";
        syncWhitelistClear(guildId, type);

        let msg = "";
        if (type === "users") {
          msg = "🧹 Cleared all **whitelisted users** across AntiNuke, AntiRaid, and AutoMod.";
        } else if (type === "roles") {
          msg = "🧹 Cleared all **whitelisted roles** across AntiNuke, AntiRaid, and AutoMod.";
        } else {
          msg = "💥 Cleared all **whitelisted users and roles** across AntiNuke, AntiRaid, and AutoMod.";
        }

        await interaction.reply({ content: `✅ ${msg}` });
        return;
      }
    }

    // ─────────────────────────────────────────────────────────────
    // EXTRA OWNER SUBCOMMANDS
    // ─────────────────────────────────────────────────────────────
    if (group === "extraowner") {
      if (sub === "add") {
        const target = interaction.options.getUser("user", true);
        if (config.extraOwners.includes(target.id)) {
          await interaction.reply({
            content: `ℹ️ <@${target.id}> is already an Extra Owner.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        updateAntiNukeConfig(guildId, {
          extraOwners: [...config.extraOwners, target.id],
        });

        await interaction.reply({
          content: `👑 Successfully granted **Extra Owner** status to <@${target.id}>. They have full immunity and Anti-Nuke management rights.`,
        });
        return;
      }

      if (sub === "remove") {
        const target = interaction.options.getUser("user", true);
        if (!config.extraOwners.includes(target.id)) {
          await interaction.reply({
            content: `⚠️ <@${target.id}> is not an Extra Owner.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        updateAntiNukeConfig(guildId, {
          extraOwners: config.extraOwners.filter((id) => id !== target.id),
        });

        await interaction.reply({
          content: `✅ Successfully removed <@${target.id}> from **Extra Owners**.`,
        });
        return;
      }

      if (sub === "list") {
        const list = [
          `👑 **Server Owner:** <@${interaction.guild.ownerId}> (\`${interaction.guild.ownerId}\`)`,
          "",
          "**Extra Owners:**",
          ...(config.extraOwners.length > 0
            ? config.extraOwners.map((id) => `• <@${id}> (\`${id}\`)`)
            : ["_None configured._"]),
        ].join("\n");

        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.primary)
          .setTitle("👑 Anti-Nuke Server Owners")
          .setDescription(list)
          .setFooter({ text: `${BRAND.name} Security System` });

        await interaction.reply({ embeds: [embed] });
        return;
      }
    }

    // ─────────────────────────────────────────────────────────────
    // DIRECT SUBCOMMANDS
    // ─────────────────────────────────────────────────────────────
    if (sub === "enable") {
      updateAntiNukeConfig(guildId, { enabled: true });
      await interaction.reply({
        content:
          "🟢 **Anti-Nuke Protection Activated!** All modules (Anti-Bot, Mass Channel/Role/Ban/Kick/Webhook Delete & Create) are now actively guarding the server 24/7.",
      });
      return;
    }

    if (sub === "disable") {
      updateAntiNukeConfig(guildId, { enabled: false });
      await interaction.reply({
        content:
          "🔴 **Anti-Nuke Protection Paused.** Server security filters are currently disabled.",
      });
      return;
    }

    if (sub === "punishment") {
      const punishment = interaction.options.getString("action", true) as AntiNukePunishment;
      updateAntiNukeConfig(guildId, { punishment });
      await interaction.reply({
        content: `⚖️ **Punishment Updated:** Anti-Nuke violators will now receive: **${punishment.toUpperCase()}**.`,
      });
      return;
    }

    if (sub === "logs") {
      const channel = interaction.options.getChannel("channel", true) as TextChannel;
      updateAntiNukeConfig(guildId, { logChannelId: channel.id });
      await interaction.reply({
        content: `📝 **Security Logs Updated:** Anti-nuke security alerts will be dispatched to <#${channel.id}>.`,
      });
      return;
    }

    if (sub === "setup") {
      const logChannel = interaction.options.getChannel("log-channel") as TextChannel | null;
      const punishment =
        (interaction.options.getString("punishment") as AntiNukePunishment | null) || "ban";

      const updated = updateAntiNukeConfig(guildId, {
        enabled: true,
        punishment,
        logChannelId: logChannel ? logChannel.id : config.logChannelId,
      });

      const setupEmbed = new EmbedBuilder()
        .setColor(0x00cc66)
        .setTitle("🛡️ Anti-Nuke System Initialized")
        .setDescription(
          "Krypton-grade Anti-Nuke protection has been successfully enabled on **" +
            interaction.guild.name +
            "**!"
        )
        .addFields(
          { name: "🛡️ Shield Status", value: "🟢 **Active & Guarding**", inline: true },
          { name: "⚖️ Violation Punishment", value: `\`${updated.punishment.toUpperCase()}\``, inline: true },
          {
            name: "📝 Security Log Channel",
            value: updated.logChannelId ? `<#${updated.logChannelId}>` : "_Not set_",
            inline: true,
          },
          {
            name: "🤖 Anti-Bot Protection",
            value: "🟢 Enabled (Instant kick unauthorized bot & punish inviter)",
            inline: false,
          },
          {
            name: "⚡ Rate Limit Thresholds",
            value:
              "• **Channel Delete:** Max 2 / 10s\n" +
              "• **Channel Create:** Max 3 / 10s\n" +
              "• **Role Delete:** Max 2 / 10s\n" +
              "• **Role Create:** Max 3 / 10s\n" +
              "• **Member Ban:** Max 3 / 10s\n" +
              "• **Member Kick:** Max 3 / 10s\n" +
              "• **Webhook Create:** Max 2 / 10s\n" +
              "• **Server Update:** Anti-Vanity / Anti-Rename Active",
            inline: false,
          }
        )
        .setFooter({ text: `${BRAND.name} Security Shield` })
        .setTimestamp();

      await interaction.reply({ embeds: [setupEmbed] });
      return;
    }

    if (sub === "settings") {
      const f = config.features;
      const embed = new EmbedBuilder()
        .setColor(config.enabled ? 0xb1121f : 0x777777)
        .setAuthor({
          name: `🛡️ KRYPTON DEFENSE CONFIGURATION`,
          iconURL: interaction.guild.iconURL() || undefined,
        })
        .setTitle(`Security Shield: ${config.enabled ? "🟢 ENABLED (24/7 ACTIVE)" : "🔴 DISABLED"}`)
        .setDescription(
          `Comprehensive real-time protection guarding **${interaction.guild.name}** against malicious administrators, rogue bots, and token grabbers.`
        )
        .addFields(
          {
            name: "⚖️ Default Punishment",
            value: `\`${config.punishment.toUpperCase()}\``,
            inline: true,
          },
          {
            name: "📝 Log Channel",
            value: config.logChannelId ? `<#${config.logChannelId}>` : "_None_",
            inline: true,
          },
          {
            name: "👑 Extra Owners",
            value: `${config.extraOwners.length} user(s)`,
            inline: true,
          },
          {
            name: "🤖 Anti-Bot",
            value: f.antiBot.enabled ? "🟢 Enabled (Auto-Kick)" : "🔴 Disabled",
            inline: true,
          },
          {
            name: "📁 Channel Delete / Create",
            value: `Max ${f.channelDelete.limit} / ${f.channelDelete.windowSeconds}s`,
            inline: true,
          },
          {
            name: "🎭 Role Delete / Create",
            value: `Max ${f.roleDelete.limit} / ${f.roleDelete.windowSeconds}s`,
            inline: true,
          },
          {
            name: "🔨 Member Ban / Kick",
            value: `Max ${f.memberBan.limit} / ${f.memberBan.windowSeconds}s`,
            inline: true,
          },
          {
            name: "🔗 Webhook Protection",
            value: `Max ${f.webhookCreate.limit} / ${f.webhookCreate.windowSeconds}s`,
            inline: true,
          },
          {
            name: "🌐 Server Tamper Protection",
            value: f.guildUpdate.enabled ? "🟢 Active" : "🔴 Disabled",
            inline: true,
          },
          {
            name: "👥 Whitelisted Users",
            value:
              config.whitelistedUsers.length > 0
                ? config.whitelistedUsers.map((id) => `<@${id}>`).join(", ")
                : "_No whitelisted users_",
            inline: true,
          },
          {
            name: "🛡️ Whitelisted Roles",
            value:
              config.whitelistedRoles.length > 0
                ? config.whitelistedRoles.map((id) => `<@&${id}>`).join(", ")
                : "_No whitelisted roles_",
            inline: true,
          }
        )
        .setFooter({
          text: `${BRAND.name} Security System • Krypton Engine`,
          iconURL: interaction.client.user?.displayAvatarURL(),
        })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }
  },
};

export default command;
