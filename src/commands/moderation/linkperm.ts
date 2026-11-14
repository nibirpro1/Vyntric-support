import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  Role,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { Command } from "../../structures/Command";
import { getAutoModConfig, setLinkPermRoleId } from "../../lib/automodStore";
import { getLoggingConfig } from "../../lib/loggingStore";
import { BRAND } from "../../lib/brand";

async function getOrCreateLinkRole(interaction: ChatInputCommandInteraction): Promise<Role | null> {
  const guild = interaction.guild;
  if (!guild) return null;

  const autoMod = getAutoModConfig(guild.id);
  if (autoMod.linkPermRoleId) {
    const existing = guild.roles.cache.get(autoMod.linkPermRoleId);
    if (existing) return existing;
  }

  // Look for existing role by name
  const existingByName = guild.roles.cache.find(
    (r) =>
      r.name.toLowerCase().includes("link perm") ||
      r.name.toLowerCase().includes("link access")
  );
  if (existingByName) {
    setLinkPermRoleId(guild.id, existingByName.id);
    return existingByName;
  }

  // Create role if not found
  try {
    const created = await guild.roles.create({
      name: "🔗 Link Perms",
      color: 0x3498db,
      reason: "AutoMod Link Permissions role for Vyntric",
    });
    setLinkPermRoleId(guild.id, created.id);
    return created;
  } catch (err) {
    console.error("[linkperm:createRole:error]", err);
    return null;
  }
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("linkperm")
    .setDescription("Manage link posting permissions & 🔗 Link Perms role")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
      sub
        .setName("give")
        .setDescription("Give link posting permission to a member (adds 🔗 Link Perms role)")
        .addUserOption((opt) =>
          opt.setName("member").setDescription("Member to grant link permission to").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason for granting link permission").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Revoke link posting permission from a member (removes 🔗 Link Perms role)")
        .addUserOption((opt) =>
          opt.setName("member").setDescription("Member to revoke link permission from").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason for revoking link permission").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("check")
        .setDescription("Check whether a member currently has link posting permissions")
        .addUserOption((opt) =>
          opt.setName("member").setDescription("Member to check").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List all members who currently have link posting permission")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const sub = interaction.options.getSubcommand();
    const isEphemeral = sub === "check" || sub === "list";
    await interaction.deferReply({ flags: isEphemeral ? MessageFlags.Ephemeral : undefined });

    const linkRole = await getOrCreateLinkRole(interaction);
    if (!linkRole) {
      await interaction.editReply({
        content: "❌ Failed to find or create the `🔗 Link Perms` role. Please check the bot's permissions.",
      });
      return;
    }

    // Role position check for giving/removing
    const botMember = interaction.guild.members.me;
    if (
      (sub === "give" || sub === "remove") &&
      botMember &&
      linkRole.position >= botMember.roles.highest.position
    ) {
      await interaction.editReply({
        content: `❌ I cannot manage the role **${linkRole.name}** because it is positioned higher than my highest role. Please move my role above **${linkRole.name}** in Server Settings > Roles.`,
      });
      return;
    }

    switch (sub) {
      case "give": {
        const targetUser = interaction.options.getUser("member", true);
        const reason = interaction.options.getString("reason") || "Granted by staff";
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) {
          await interaction.editReply({ content: "❌ That member is not currently in this server." });
          return;
        }

        if (member.roles.cache.has(linkRole.id)) {
          await interaction.editReply({
            content: `⚠️ **${member.user.tag}** already has the **${linkRole.name}** role!`,
          });
          return;
        }

        try {
          await member.roles.add(linkRole, `${reason} (by ${interaction.user.tag})`);

          const embed = new EmbedBuilder()
            .setColor(BRAND.colors.success)
            .setTitle("🔗 Link Posting Permission Granted")
            .setDescription(`**${member.user}** has been given link posting permissions!`)
            .addFields(
              { name: "Target Member", value: `${member.user} (\`${member.user.tag}\`)`, inline: true },
              { name: "Assigned Role", value: `<@&${linkRole.id}>`, inline: true },
              { name: "Moderator", value: `${interaction.user} (\`${interaction.user.tag}\`)`, inline: true },
              { name: "Reason", value: `\`${reason}\``, inline: false },
              {
                name: "Note",
                value: "This member can now post links and media without being blocked by AutoMod Anti-Link. *(Anti-Phishing & Anti-Gali filters remain active for safety.)*",
                inline: false,
              }
            )
            .setFooter({ text: `${BRAND.name} Security • Link Permissions` })
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });

          // Send DM to member
          try {
            const dmEmbed = new EmbedBuilder()
              .setColor(BRAND.colors.success)
              .setTitle("🔗 Link Permission Granted")
              .setDescription(
                `You have been granted permission to post links in **${interaction.guild.name}** by staff!`
              )
              .setFooter({ text: BRAND.footer })
              .setTimestamp();
            await member.send({ embeds: [dmEmbed] });
          } catch {}

          // Mod Log notification
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
        break;
      }

      case "remove": {
        const targetUser = interaction.options.getUser("member", true);
        const reason = interaction.options.getString("reason") || "Revoked by staff";
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) {
          await interaction.editReply({ content: "❌ That member is not currently in this server." });
          return;
        }

        if (!member.roles.cache.has(linkRole.id)) {
          await interaction.editReply({
            content: `⚠️ **${member.user.tag}** does not have the **${linkRole.name}** role.`,
          });
          return;
        }

        try {
          await member.roles.remove(linkRole, `${reason} (by ${interaction.user.tag})`);

          const embed = new EmbedBuilder()
            .setColor(BRAND.colors.danger)
            .setTitle("🚫 Link Posting Permission Revoked")
            .setDescription(`**${member.user}** can no longer post external links.`)
            .addFields(
              { name: "Target Member", value: `${member.user} (\`${member.user.tag}\`)`, inline: true },
              { name: "Removed Role", value: `<@&${linkRole.id}>`, inline: true },
              { name: "Moderator", value: `${interaction.user} (\`${interaction.user.tag}\`)`, inline: true },
              { name: "Reason", value: `\`${reason}\``, inline: false }
            )
            .setFooter({ text: `${BRAND.name} Security • Link Permissions` })
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });
        } catch (err: any) {
          await interaction.editReply({
            content: `❌ Failed to remove role: ${err.message || "Missing Manage Roles permission"}`,
          });
        }
        break;
      }

      case "check": {
        const targetUser = interaction.options.getUser("member", true);
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) {
          await interaction.editReply({ content: "❌ That member is not currently in this server." });
          return;
        }

        const hasRole = member.roles.cache.has(linkRole.id);
        const autoMod = getAutoModConfig(interaction.guild.id);
        const isExempt =
          hasRole ||
          autoMod.exemptUsers.includes(member.id) ||
          member.roles.cache.some((r) => autoMod.exemptRoles.includes(r.id));

        const embed = new EmbedBuilder()
          .setColor(isExempt ? BRAND.colors.success : BRAND.colors.neutral)
          .setTitle(`🔗 Link Permission Status: ${member.user.tag}`)
          .addFields(
            { name: "Has Link Perms Role", value: hasRole ? `✅ Yes (<@&${linkRole.id}>)` : "❌ No", inline: true },
            { name: "Can Post Links", value: isExempt ? "✅ Allowed" : "❌ Blocked by AutoMod", inline: true }
          )
          .setFooter({ text: BRAND.footer })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case "list": {
        await interaction.guild.members.fetch();
        const membersWithRole = linkRole.members;

        const count = membersWithRole.size;
        const listText =
          count > 0
            ? membersWithRole.map((m) => `• ${m.user} (\`${m.user.tag}\`)`).slice(0, 30).join("\n") +
              (count > 30 ? `\n_...and ${count - 30} more_` : "")
            : "_No members currently have this role._";

        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.primary)
          .setTitle(`🔗 Members with Link Posting Permissions (${count})`)
          .setDescription(listText)
          .addFields({
            name: "Role Info",
            value: `Role: <@&${linkRole.id}> (ID: \`${linkRole.id}\`)`,
            inline: false,
          })
          .setFooter({ text: `${BRAND.name} Security • Link Permissions` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        break;
      }
    }
  },
};

export default command;
