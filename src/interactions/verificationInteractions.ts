import {
  ButtonInteraction,
  EmbedBuilder,
  Guild,
  GuildMember,
  MessageFlags,
  TextChannel,
} from "discord.js";
import { VyntricClient } from "../structures/VyntricClient";
import { getVerificationConfig, VerificationConfig } from "../lib/verificationStore";
import { BRAND } from "../lib/brand";

export interface VerificationResult {
  ok: boolean;
  reason?: "not_configured" | "no_member" | "no_role" | "already_verified" | "cooldown" | "hierarchy" | "error";
  message?: string;
  remainingMin?: number;
  unlockTimestamp?: number;
}

/**
 * Shared verification executor used by both Reaction and Button events.
 */
export async function executeMemberVerification(options: {
  guild: Guild;
  member: GuildMember;
  config: VerificationConfig;
  client: VyntricClient;
  source: "button" | "reaction";
}): Promise<VerificationResult> {
  const { guild, member, config, client, source } = options;

  if (!config.enabled || !config.roleId) {
    return {
      ok: false,
      reason: "not_configured",
      message: "The verification system is not fully configured on this server yet.",
    };
  }

  const targetRole = guild.roles.cache.get(config.roleId);
  if (!targetRole) {
    return {
      ok: false,
      reason: "no_role",
      message: "The verified role configured for this server was not found.",
    };
  }

  // Check if member is already verified
  if (member.roles.cache.has(config.roleId)) {
    return {
      ok: true,
      reason: "already_verified",
      message: `You are already verified with the <@&${config.roleId}> role.`,
    };
  }

  // Security wait cooldown
  if (config.waitMinutes > 0 && member.joinedTimestamp) {
    const elapsedMs = Date.now() - member.joinedTimestamp;
    const requiredMs = config.waitMinutes * 60 * 1000;
    if (elapsedMs < requiredMs) {
      const remainingMs = requiredMs - elapsedMs;
      const remainingSec = Math.ceil(remainingMs / 1000);
      const remainingMin = Math.ceil(remainingSec / 60);
      const unlockTimestamp = Math.floor((member.joinedTimestamp + requiredMs) / 1000);

      return {
        ok: false,
        reason: "cooldown",
        remainingMin,
        unlockTimestamp,
        message: `Security cooldown active. Please wait ${remainingMin} more minute(s).`,
      };
    }
  }

  // Verify role hierarchy
  const botMember = guild.members.me;
  if (botMember && botMember.roles.highest.position <= targetRole.position) {
    return {
      ok: false,
      reason: "hierarchy",
      message: `Bot role is below or equal to ${targetRole.name} in role hierarchy.`,
    };
  }

  // Perform role addition & optional unverified removal
  try {
    await member.roles.add(targetRole, "Vyntric Member Verification Passed");

    if (config.unverifiedRoleId && member.roles.cache.has(config.unverifiedRoleId)) {
      const unverifiedRole = guild.roles.cache.get(config.unverifiedRoleId);
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
    return {
      ok: false,
      reason: "error",
      message: err.message || "Failed to assign role.",
    };
  }

  // Optional audit logging
  if (config.logChannelId) {
    const logChannel = guild.channels.cache.get(config.logChannelId) as
      | TextChannel
      | undefined;
    if (logChannel && logChannel.isTextBased()) {
      const logEmbed = new EmbedBuilder()
        .setColor(0x00cc66)
        .setAuthor({
          name: `${member.user.tag} (${member.id})`,
          iconURL: member.user.displayAvatarURL(),
        })
        .setDescription(
          `🛡️ <@${member.id}> passed verification via **${source === "reaction" ? "Reaction ✅" : "Button"}** and was given <@&${targetRole.id}>.`
        )
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

  // If reaction, notify member via DM
  if (source === "reaction") {
    const dmEmbed = new EmbedBuilder()
      .setColor(BRAND.colors.primary)
      .setTitle("✅ Verification Successful!")
      .setDescription(
        `Welcome to **${guild.name}**, <@${member.id}>!\n\n` +
          `You have reacted to verify and have been granted the <@&${targetRole.id}> role.\n` +
          `Full access to all community channels is now unlocked.\n\n` +
          `Enjoy your stay and remember to follow our rules!`
      )
      .setThumbnail(guild.iconURL({ size: 256 }) ?? null)
      .setFooter({
        text: `${BRAND.name} Security System`,
        iconURL: client.user?.displayAvatarURL(),
      });

    await member.send({ embeds: [dmEmbed] }).catch(() => {});
  }

  return { ok: true };
}

export async function handleVerificationButton(
  interaction: ButtonInteraction,
  client: VyntricClient
) {
  if (!interaction.guild) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guildId = interaction.guild.id;
  const config = getVerificationConfig(guildId);

  const member =
    interaction.guild.members.cache.get(interaction.user.id) ||
    (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));

  if (!member) {
    await interaction.editReply({
      content: "⚠️ Could not retrieve your server member profile. Please try again.",
    });
    return;
  }

  const result = await executeMemberVerification({
    guild: interaction.guild,
    member,
    config,
    client,
    source: "button",
  });

  if (!result.ok) {
    if (result.reason === "cooldown") {
      await interaction.editReply({
        content:
          `⏳ **Security Cooldown Active**\n` +
          `To protect **${interaction.guild.name}** against automated spam and raid bots, new members must wait **${config.waitMinutes} minutes** after joining before verification becomes available.\n\n` +
          `⏱️ Please wait **${result.remainingMin} more minute(s)** (unlocks <t:${result.unlockTimestamp}:R>) and then verify again!`,
      });
      return;
    }

    if (result.reason === "hierarchy") {
      await interaction.editReply({
        content:
          `⚠️ I cannot assign the verified role because my highest role is lower than or equal to it in the Discord Role Hierarchy.\n\n` +
          `Please ask a server administrator to drag the bot role above the verified role in Server Settings → Roles.`,
      });
      return;
    }

    await interaction.editReply({
      content: `⚠️ Verification check failed: ${result.message || "Unknown error"}.`,
    });
    return;
  }

  if (result.reason === "already_verified") {
    await interaction.editReply({
      content: `ℹ️ **You are already verified!**\nYou already possess the <@&${config.roleId}> role and have full access to **${interaction.guild.name}**.`,
    });
    return;
  }

  const targetRole = interaction.guild.roles.cache.get(config.roleId!);
  const successEmbed = new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setTitle("✅ Verification Successful!")
    .setDescription(
      `Welcome to **${interaction.guild.name}**, <@${member.id}>!\n\n` +
        `You have been granted the <@&${targetRole?.id}> role and unlocked full access to all community channels.\n\n` +
        `Please be sure to follow our rules and enjoy your stay!`
    )
    .setThumbnail(interaction.guild.iconURL({ size: 256 }) ?? null)
    .setFooter({
      text: `${BRAND.name} Security System`,
      iconURL: client.user?.displayAvatarURL(),
    });

  await interaction.editReply({ embeds: [successEmbed] });
}
