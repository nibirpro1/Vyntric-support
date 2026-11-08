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
  formatBoosterText,
  getBoosterConfig,
  updateBoosterConfig,
} from "../../lib/boosterStore";
import { BRAND } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("booster")
    .setDescription("Configure automatic Server Booster role and celebration announcements")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Configure the booster role and announcement channel")
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("The role to automatically grant to server boosters")
            .setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to announce new boosts")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt
            .setName("dm")
            .setDescription("Whether to send a thank-you DM to the booster (default: true)")
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName("message")
            .setDescription("Custom announcement message ({user}, {username}, {server}, {boostCount}, {level})")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("sync")
        .setDescription("Check all current server boosters and assign missing booster roles")
    )
    .addSubcommand((sub) =>
      sub
        .setName("test")
        .setDescription("Preview or test the boost announcement embed")
    )
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("View current Server Booster configuration and statistics")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const config = getBoosterConfig(guildId);

    switch (sub) {
      case "setup": {
        const role = interaction.options.getRole("role", true);
        const channel = interaction.options.getChannel("channel") as TextChannel | null;
        const dm = interaction.options.getBoolean("dm");
        const msg = interaction.options.getString("message");

        updateBoosterConfig(guildId, {
          enabled: true,
          roleId: role.id,
          ...(channel ? { channelId: channel.id } : {}),
          ...(dm !== null ? { dmEnabled: dm } : {}),
          ...(msg ? { message: msg } : {}),
        });

        const updated = getBoosterConfig(guildId);

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xf47fff)
              .setTitle("🚀 Server Booster System Configured")
              .setDescription(
                `Booster automation is now **enabled** for **${interaction.guild.name}**!\n` +
                `Whenever someone boosts the server, they will automatically receive the configured role.`
              )
              .addFields(
                { name: "👑 Booster Role", value: `<@&${updated.roleId}>`, inline: true },
                {
                  name: "📢 Announcement Channel",
                  value: updated.channelId ? `<#${updated.channelId}>` : "_None (No channel announcement)_",
                  inline: true,
                },
                {
                  name: "📨 Thank-You DM",
                  value: updated.dmEnabled ? "✅ Enabled" : "❌ Disabled",
                  inline: true,
                }
              )
              .setFooter({ text: `${BRAND.name} Booster Automation` }),
          ],
        });
        break;
      }

      case "sync": {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!config.roleId) {
          await interaction.editReply({
            content: "⚠️ No booster role configured. Run `/booster setup role:@Role` first.",
          });
          return;
        }

        const targetRole = interaction.guild.roles.cache.get(config.roleId);
        if (!targetRole) {
          await interaction.editReply({
            content: "⚠️ The configured booster role was not found in this server.",
          });
          return;
        }

        const botMember = interaction.guild.members.me;
        if (botMember && botMember.roles.highest.position <= targetRole.position) {
          await interaction.editReply({
            content: `⚠️ Bot's highest role is lower than **${targetRole.name}**. Move bot role higher in Server Settings → Roles.`,
          });
          return;
        }

        // Fetch all members to find active boosters
        const allMembers = await interaction.guild.members.fetch();
        let grantedCount = 0;
        let totalBoosters = 0;

        for (const [, member] of allMembers) {
          if (member.premiumSince) {
            totalBoosters++;
            if (!member.roles.cache.has(targetRole.id)) {
              try {
                await member.roles.add(targetRole, "Booster Sync");
                grantedCount++;
              } catch (err) {
                console.error(`[booster:sync] Failed to add role to ${member.user.tag}:`, err);
              }
            }
          }
        }

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xf47fff)
              .setTitle("💎 Booster Role Sync Complete")
              .setDescription(
                `Found **${totalBoosters} active boosters** in **${interaction.guild.name}**.\n\n` +
                `✅ **${grantedCount} member(s)** were missing the <@&${targetRole.id}> role and have now received it!`
              )
              .setFooter({ text: `${BRAND.name} Booster Automation` }),
          ],
        });
        break;
      }

      case "test": {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const boostCount = interaction.guild.premiumSubscriptionCount || 1;
        const level = interaction.guild.premiumTier;

        const desc = formatBoosterText(config.message, {
          user: `<@${interaction.user.id}>`,
          username: interaction.user.username,
          server: interaction.guild.name,
          boostCount,
          level,
        });

        const embed = new EmbedBuilder()
          .setColor(0xf47fff)
          .setTitle("[TEST PREVIEW] 🚀 NEW SERVER BOOST!")
          .setDescription(desc)
          .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
          .addFields(
            { name: "💎 Total Server Boosts", value: `**${boostCount} Boosts**`, inline: true },
            { name: "⚡ Server Level", value: `**Level ${level}**`, inline: true },
            { name: "👑 Booster", value: `<@${interaction.user.id}>`, inline: true }
          )
          .setFooter({
            text: `${BRAND.name} Booster Perks • Preview Test`,
            iconURL: interaction.guild.iconURL() ?? undefined,
          })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case "status": {
        await interaction.deferReply();

        const roleText = config.roleId ? `<@&${config.roleId}>` : "❌ _Not configured_";
        const channelText = config.channelId ? `<#${config.channelId}>` : "_None (No channel announcement)_";
        const totalBoosts = interaction.guild.premiumSubscriptionCount || 0;
        const tier = interaction.guild.premiumTier;

        const embed = new EmbedBuilder()
          .setColor(0xf47fff)
          .setTitle(`💎 ${interaction.guild.name} • Server Booster Status`)
          .addFields(
            { name: "🔘 Automation Status", value: config.enabled ? "✅ Enabled" : "❌ Disabled", inline: true },
            { name: "👑 Booster Role", value: roleText, inline: true },
            { name: "📢 Announcement Channel", value: channelText, inline: true },
            { name: "💎 Active Boosts", value: `**${totalBoosts} Boosts**`, inline: true },
            { name: "⚡ Boost Tier", value: `**Level ${tier}**`, inline: true },
            { name: "📨 Thank-You DM", value: config.dmEnabled ? "✅ Enabled" : "❌ Disabled", inline: true }
          )
          .setFooter({ text: "Use /booster setup or /booster sync to manage settings" });

        await interaction.editReply({ embeds: [embed] });
        break;
      }
    }
  },
};

export default command;
