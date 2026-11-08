import { ButtonInteraction, EmbedBuilder, MessageFlags, TextChannel } from "discord.js";
import { VyntricClient } from "../structures/VyntricClient";
import { getVerificationConfig } from "../lib/verificationStore";
import { BRAND } from "../lib/brand";

export async function handleVerificationButton(
  interaction: ButtonInteraction,
  client: VyntricClient
) {
  if (!interaction.guild) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guildId = interaction.guild.id;
  const config = getVerificationConfig(guildId);

  if (!config.enabled || !config.roleId) {
    await interaction.editReply({
      content:
        "⚠️ The verification system is not fully configured on this server yet. An administrator needs to run `/verify setup`.",
    });
    return;
  }

  const member =
    interaction.guild.members.cache.get(interaction.user.id) ||
    (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));

  if (!member) {
    await interaction.editReply({
      content: "⚠️ Could not retrieve your server member profile. Please try again.",
    });
    return;
  }

  const targetRole = interaction.guild.roles.cache.get(config.roleId);
  if (!targetRole) {
    await interaction.editReply({
      content:
        "⚠️ The verified role configured for this server was not found. Please notify a moderator or administrator.",
    });
    return;
  }

  // Check if member is already verified
  if (member.roles.cache.has(config.roleId)) {
    await interaction.editReply({
      content: `ℹ️ **You are already verified!**\nYou already possess the <@&${config.roleId}> role and have full access to **${interaction.guild.name}**.`,
    });
    return;
  }

  // Security wait cooldown (e.g. 5 minutes from join, as seen in server screenshots)
  if (config.waitMinutes > 0 && member.joinedTimestamp) {
    const elapsedMs = Date.now() - member.joinedTimestamp;
    const requiredMs = config.waitMinutes * 60 * 1000;
    if (elapsedMs < requiredMs) {
      const remainingMs = requiredMs - elapsedMs;
      const remainingSec = Math.ceil(remainingMs / 1000);
      const remainingMin = Math.ceil(remainingSec / 60);
      const unlockTimestamp = Math.floor((member.joinedTimestamp + requiredMs) / 1000);

      await interaction.editReply({
        content:
          `⏳ **Security Cooldown Active**\n` +
          `To protect **${interaction.guild.name}** against automated spam and raid bots, new members must wait **${config.waitMinutes} minutes** after joining before verification becomes available.\n\n` +
          `⏱️ Please wait **${remainingMin} more minute(s)** (unlocks <t:${unlockTimestamp}:R>) and then click **Verify** again!`,
      });
      return;
    }
  }

  // Verify role hierarchy
  const botMember = interaction.guild.members.me;
  if (botMember && botMember.roles.highest.position <= targetRole.position) {
    await interaction.editReply({
      content:
        `⚠️ I cannot assign the **${targetRole.name}** role because my highest role is lower than or equal to it in the Discord Role Hierarchy.\n\n` +
        `Please ask a server administrator to drag the **${botMember.roles.highest.name}** role above **${targetRole.name}** in Server Settings → Roles.`,
    });
    return;
  }

  // Perform role addition & optional unverified removal
  try {
    await member.roles.add(targetRole, "Vyntric Member Verification Passed");

    if (config.unverifiedRoleId && member.roles.cache.has(config.unverifiedRoleId)) {
      const unverifiedRole = interaction.guild.roles.cache.get(config.unverifiedRoleId);
      if (
        unverifiedRole &&
        botMember &&
        botMember.roles.highest.position > unverifiedRole.position
      ) {
        await member.roles.remove(
          unverifiedRole,
          "Vyntric Member Verified — Removed Unverified Role"
        );
      }
    }
  } catch (err: any) {
    console.error("[verification:assign]", err);
    await interaction.editReply({
      content: `⚠️ Failed to assign the verified role: ${err.message || "Unknown error"}. Please check bot permissions.`,
    });
    return;
  }

  const successEmbed = new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setTitle("✅ Verification Successful!")
    .setDescription(
      `Welcome to **${interaction.guild.name}**, <@${member.id}>!\n\n` +
        `You have been granted the <@&${targetRole.id}> role and unlocked full access to all community channels.\n\n` +
        `Please be sure to follow our rules and enjoy your stay!`
    )
    .setThumbnail(interaction.guild.iconURL({ size: 256 }) ?? null)
    .setFooter({
      text: `${BRAND.name} Security System`,
      iconURL: client.user?.displayAvatarURL(),
    });

  await interaction.editReply({ embeds: [successEmbed] });

  // Optional audit logging
  if (config.logChannelId) {
    const logChannel = interaction.guild.channels.cache.get(config.logChannelId) as
      | TextChannel
      | undefined;
    if (logChannel && logChannel.isTextBased()) {
      const logEmbed = new EmbedBuilder()
        .setColor(0x00cc66)
        .setAuthor({
          name: `${member.user.tag} (${member.id})`,
          iconURL: member.user.displayAvatarURL(),
        })
        .setDescription(`🛡️ <@${member.id}> passed verification and was given <@&${targetRole.id}>.`)
        .addFields(
          {
            name: "Account Created",
            value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
            inline: true,
          },
          {
            name: "Joined Server",
            value: `<t:${Math.floor((member.joinedTimestamp || Date.now()) / 1000)}:R>`,
            inline: true,
          }
        )
        .setTimestamp();

      await logChannel.send({ embeds: [logEmbed] }).catch(() => null);
    }
  }
}
