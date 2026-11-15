import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { Command } from "../../structures/Command";
import {
  FeaturePermission,
  PERMISSION_ROLE_DEFS,
  resolveFeatureRole,
} from "../../lib/permissionRolesStore";
import { getAutoModConfig } from "../../lib/automodStore";
import { getLoggingConfig } from "../../lib/loggingStore";
import { BRAND } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("perms")
    .setDescription("Modular Feature Permission Roles (Links, Media, Announce, Giveaways, VC, etc.)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
      sub
        .setName("give")
        .setDescription("Grant a specific feature permission role to a member")
        .addUserOption((opt) =>
          opt.setName("member").setDescription("Member to grant permission to").setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("feature")
            .setDescription("The feature permission to grant")
            .setRequired(true)
            .addChoices(
              { name: "🔗 Links & Invites (🔗 Link Perms)", value: "link" },
              { name: "🖼️ Media & Attachments (🖼️ Media Perms)", value: "media" },
              { name: "📢 Server Announce (📢 Server Announce)", value: "announce_server" },
              { name: "⚔️ UHC Announce (⚔️ UHC Announce)", value: "announce_uhc" },
              { name: "🎁 Giveaways (🎁 Giveaway Perms)", value: "giveaway" },
              { name: "🎙️ Voice Mod (🎙️ VC Mod Perms)", value: "vcmod" },
              { name: "🔔 Mass Mentions (🔔 Mention Perms)", value: "mention" },
              { name: "🛡️ AutoMod Bypass (🛡️ AutoMod Bypass)", value: "automod_bypass" }
            )
        )
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason for granting this permission").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Revoke a specific feature permission role from a member")
        .addUserOption((opt) =>
          opt.setName("member").setDescription("Member to revoke permission from").setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("feature")
            .setDescription("The feature permission to revoke")
            .setRequired(true)
            .addChoices(
              { name: "🔗 Links & Invites (🔗 Link Perms)", value: "link" },
              { name: "🖼️ Media & Attachments (🖼️ Media Perms)", value: "media" },
              { name: "📢 Server Announce (📢 Server Announce)", value: "announce_server" },
              { name: "⚔️ UHC Announce (⚔️ UHC Announce)", value: "announce_uhc" },
              { name: "🎁 Giveaways (🎁 Giveaway Perms)", value: "giveaway" },
              { name: "🎙️ Voice Mod (🎙️ VC Mod Perms)", value: "vcmod" },
              { name: "🔔 Mass Mentions (🔔 Mention Perms)", value: "mention" },
              { name: "🛡️ AutoMod Bypass (🛡️ AutoMod Bypass)", value: "automod_bypass" }
            )
        )
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason for revoking this permission").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("check")
        .setDescription("Check all feature permissions for a specific member")
        .addUserOption((opt) =>
          opt.setName("member").setDescription("Member to inspect").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List all members who hold a specific feature permission")
        .addStringOption((opt) =>
          opt
            .setName("feature")
            .setDescription("Feature permission")
            .setRequired(true)
            .addChoices(
              { name: "🔗 Links & Invites", value: "link" },
              { name: "🖼️ Media & Attachments", value: "media" },
              { name: "📢 Server Announce", value: "announce_server" },
              { name: "⚔️ UHC Announce", value: "announce_uhc" },
              { name: "🎁 Giveaways", value: "giveaway" },
              { name: "🎙️ Voice Mod", value: "vcmod" },
              { name: "🔔 Mass Mentions", value: "mention" },
              { name: "🛡️ AutoMod Bypass", value: "automod_bypass" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub.setName("roles").setDescription("Display all 7 modular feature permission roles and their status")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const sub = interaction.options.getSubcommand();
    const isEphemeral = sub === "check" || sub === "list" || sub === "roles";
    await interaction.deferReply({ flags: isEphemeral ? MessageFlags.Ephemeral : undefined });

    if (sub === "roles") {
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle("🛡️ Vyntric Modular Feature Permission Roles")
        .setDescription(
          "Each key feature in the server has a dedicated role. Grant these roles to members to give them access to specific features without giving them full Administrator permissions."
        );

      for (const def of PERMISSION_ROLE_DEFS) {
        const resolvedRole = await resolveFeatureRole(interaction.guild, def.key);
        const roleTag = resolvedRole ? `<@&${resolvedRole.id}>` : `\`${def.name}\``;
        embed.addFields({
          name: `${def.emoji} ${def.name}`,
          value: `• **Role:** ${roleTag}\n• **Capability:** ${def.description}`,
          inline: false,
        });
      }

      embed
        .setFooter({ text: "Use /perms give or /perms remove to manage permissions" })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === "check") {
      const targetUser = interaction.options.getUser("member", true);
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      if (!member) {
        await interaction.editReply({ content: "❌ That member is not currently in this server." });
        return;
      }

      const isAdmin =
        interaction.guild.ownerId === member.id ||
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.permissions.has(PermissionFlagsBits.ManageGuild);

      const embed = new EmbedBuilder()
        .setColor(isAdmin ? BRAND.colors.gold : BRAND.colors.primary)
        .setTitle(`🛡️ Permission Matrix: ${member.user.tag}`)
        .setDescription(
          isAdmin
            ? `👑 **Server Administrator / Owner** (Has full bypass across all features)\n`
            : `Feature permissions assigned to ${member.user}:\n`
        );

      for (const def of PERMISSION_ROLE_DEFS) {
        const role = await resolveFeatureRole(interaction.guild, def.key);
        const hasRole = role ? member.roles.cache.has(role.id) : false;
        const active = isAdmin || hasRole;
        const statusIcon = active ? "✅ Allowed" : "❌ Restricted";

        embed.addFields({
          name: `${def.emoji} ${def.name}`,
          value: `Status: **${statusIcon}** ${hasRole ? `(via <@&${role?.id}>)` : ""}`,
          inline: true,
        });
      }

      embed.setFooter({ text: BRAND.footer }).setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    let feature = interaction.options.getString("feature", true) as FeaturePermission;
    if ((feature as string) === "announce") feature = "announce_server";
    const def = PERMISSION_ROLE_DEFS.find((d) => d.key === feature)!;
    const role = await resolveFeatureRole(interaction.guild, feature);

    if (!role) {
      await interaction.editReply({
        content: `❌ Could not resolve or create the role for **${def.name}**. Please check bot permissions.`,
      });
      return;
    }

    if (sub === "list") {
      await interaction.guild.members.fetch();
      const membersWithRole = role.members;
      const count = membersWithRole.size;

      const listText =
        count > 0
          ? membersWithRole.map((m) => `• ${m.user} (\`${m.user.tag}\`)`).slice(0, 30).join("\n") +
            (count > 30 ? `\n_...and ${count - 30} more_` : "")
          : "_No members currently have this role._";

      const embed = new EmbedBuilder()
        .setColor(def.color)
        .setTitle(`${def.emoji} Members with ${def.name} (${count})`)
        .setDescription(listText)
        .addFields({
          name: "Role Info",
          value: `Role: <@&${role.id}> (ID: \`${role.id}\`)\n**Capability:** ${def.description}`,
          inline: false,
        })
        .setFooter({ text: BRAND.footer })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const targetUser = interaction.options.getUser("member", true);
    const reason = interaction.options.getString("reason") || "Updated by staff";
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!member) {
      await interaction.editReply({ content: "❌ That member is not currently in this server." });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (botMember && role.position >= botMember.roles.highest.position) {
      await interaction.editReply({
        content: `❌ I cannot assign **${role.name}** because it is positioned higher than my role. Please move my role higher in Server Settings > Roles.`,
      });
      return;
    }

    if (sub === "give") {
      if (member.roles.cache.has(role.id)) {
        await interaction.editReply({
          content: `⚠️ **${member.user.tag}** already has the **${role.name}** role!`,
        });
        return;
      }

      try {
        await member.roles.add(role, `${reason} (by ${interaction.user.tag})`);

        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.success)
          .setTitle(`${def.emoji} Permission Granted: ${def.name}`)
          .setDescription(`**${member.user}** has been granted **${def.name}**!`)
          .addFields(
            { name: "Target Member", value: `${member.user} (\`${member.user.tag}\`)`, inline: true },
            { name: "Assigned Role", value: `<@&${role.id}>`, inline: true },
            { name: "Moderator", value: `${interaction.user} (\`${interaction.user.tag}\`)`, inline: true },
            { name: "Capability Unlocked", value: `\`${def.description}\``, inline: false },
            { name: "Reason", value: `\`${reason}\``, inline: false }
          )
          .setFooter({ text: `${BRAND.name} Permissions • Feature Security` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        // DM Member
        try {
          const dmEmbed = new EmbedBuilder()
            .setColor(BRAND.colors.success)
            .setTitle(`${def.emoji} Permission Granted in ${interaction.guild.name}`)
            .setDescription(`You have been granted the **${def.name}** role!\n\n**Unlocked:** ${def.description}`)
            .setFooter({ text: BRAND.footer })
            .setTimestamp();
          await member.send({ embeds: [dmEmbed] });
        } catch {}

        // Mod Log
        const autoMod = getAutoModConfig(interaction.guild.id);
        const logsCfg = getLoggingConfig(interaction.guild.id);
        const logChannelId = autoMod.logChannelId || logsCfg.logChannelId || logsCfg.commandLogChannelId;
        if (logChannelId) {
          const logChannel = interaction.guild.channels.cache.get(logChannelId);
          if (logChannel && logChannel.isTextBased()) {
            await (logChannel as TextChannel).send({ embeds: [embed] }).catch(() => {});
          }
        }
      } catch (err: any) {
        await interaction.editReply({
          content: `❌ Failed to assign role: ${err.message || "Missing Manage Roles permission"}`,
        });
      }
    } else if (sub === "remove") {
      if (!member.roles.cache.has(role.id)) {
        await interaction.editReply({
          content: `⚠️ **${member.user.tag}** does not currently have the **${role.name}** role.`,
        });
        return;
      }

      try {
        await member.roles.remove(role, `${reason} (by ${interaction.user.tag})`);

        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.danger)
          .setTitle(`🚫 Permission Revoked: ${def.name}`)
          .setDescription(`**${member.user}** no longer has **${def.name}**.`)
          .addFields(
            { name: "Target Member", value: `${member.user} (\`${member.user.tag}\`)`, inline: true },
            { name: "Removed Role", value: `<@&${role.id}>`, inline: true },
            { name: "Moderator", value: `${interaction.user} (\`${interaction.user.tag}\`)`, inline: true },
            { name: "Reason", value: `\`${reason}\``, inline: false }
          )
          .setFooter({ text: `${BRAND.name} Permissions • Feature Security` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (err: any) {
        await interaction.editReply({
          content: `❌ Failed to remove role: ${err.message || "Missing Manage Roles permission"}`,
        });
      }
    }
  },
};

export default command;
