import {
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
  AntiNukePunishment,
  getAntiNukeConfig,
  updateAntiNukeConfig,
} from "../../lib/antinukeStore";
import { BRAND } from "../../lib/brand";

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
        .setDescription("Manage trusted users exempt from anti-nuke triggers")
        .addSubcommand((sub) =>
          sub
            .setName("add")
            .setDescription("Add a trusted user to the anti-nuke whitelist")
            .addUserOption((opt) =>
              opt.setName("user").setDescription("The user to whitelist").setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("remove")
            .setDescription("Remove a user from the anti-nuke whitelist")
            .addUserOption((opt) =>
              opt.setName("user").setDescription("The user to remove").setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub.setName("list").setDescription("List all whitelisted users")
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

    // Security check: Only Server Owner or Extra Owners can access Anti-Nuke settings
    const isAuthorized =
      interaction.guild.ownerId === userId || config.extraOwners.includes(userId);

    if (!isAuthorized) {
      await interaction.reply({
        content:
          "⛔ **Access Denied:** Only the **Server Owner** and configured **Extra Owners** have permission to configure Anti-Nuke security.",
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
        const target = interaction.options.getUser("user", true);
        if (config.whitelistedUsers.includes(target.id)) {
          await interaction.reply({
            content: `ℹ️ <@${target.id}> is already on the Anti-Nuke whitelist.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const updated = updateAntiNukeConfig(guildId, {
          whitelistedUsers: [...config.whitelistedUsers, target.id],
        });

        await interaction.reply({
          content: `✅ Successfully added <@${target.id}> to the **Anti-Nuke Whitelist**. They are now immune from anti-nuke rate-limit triggers.`,
        });
        return;
      }

      if (sub === "remove") {
        const target = interaction.options.getUser("user", true);
        if (!config.whitelistedUsers.includes(target.id)) {
          await interaction.reply({
            content: `⚠️ <@${target.id}> is not in the whitelist.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        updateAntiNukeConfig(guildId, {
          whitelistedUsers: config.whitelistedUsers.filter((id) => id !== target.id),
        });

        await interaction.reply({
          content: `✅ Successfully removed <@${target.id}> from the **Anti-Nuke Whitelist**.`,
        });
        return;
      }

      if (sub === "list") {
        const list =
          config.whitelistedUsers.length > 0
            ? config.whitelistedUsers.map((id) => `• <@${id}> (\`${id}\`)`).join("\n")
            : "_No whitelisted users configured._";

        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.primary)
          .setTitle("🛡️ Anti-Nuke Whitelisted Users")
          .setDescription(list)
          .setFooter({ text: `${BRAND.name} Security System` });

        await interaction.reply({ embeds: [embed] });
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
            name: "👥 Whitelisted Members",
            value:
              config.whitelistedUsers.length > 0
                ? config.whitelistedUsers.map((id) => `<@${id}>`).join(", ")
                : "_No whitelisted members_",
            inline: false,
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
