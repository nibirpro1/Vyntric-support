import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { addPunishment } from "../lib/store";
import { BRAND } from "../lib/brand";

export async function handleVoiceReportButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild) return;

  // Staff check: must have ModerateMembers, KickMembers, BanMembers, or Administrator
  const staffMember = interaction.member as any;
  const isStaff =
    interaction.guild.ownerId === interaction.user.id ||
    Boolean(staffMember?.permissions?.has(PermissionFlagsBits.ModerateMembers)) ||
    Boolean(staffMember?.permissions?.has(PermissionFlagsBits.KickMembers)) ||
    Boolean(staffMember?.permissions?.has(PermissionFlagsBits.ManageGuild)) ||
    Boolean(staffMember?.permissions?.has(PermissionFlagsBits.Administrator));

  if (!isStaff) {
    await interaction.reply({
      content: "❌ You do not have permission to moderate reports. Only server staff can take action.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // customId format: vcrep:<action>:<targetUserId>
  const parts = interaction.customId.split(":");
  const action = parts[1];
  const targetUserId = parts[2];

  const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);

  // Disable all buttons on the report message
  const originalMessage = interaction.message;
  const disabledRows = originalMessage.components.map((row: any) => {
    const newRow = ActionRowBuilder.from(row) as ActionRowBuilder<ButtonBuilder>;
    newRow.components.forEach((btn) => btn.setDisabled(true));
    return newRow;
  });

  const originalEmbed = originalMessage.embeds[0] ? EmbedBuilder.from(originalMessage.embeds[0]) : null;

  if (action === "dismiss") {
    if (originalEmbed) {
      originalEmbed
        .setColor(BRAND.colors.neutral)
        .addFields({
          name: "Resolution",
          value: `❌ **Dismissed** by ${interaction.user} (\`${interaction.user.tag}\`) • No penalty applied`,
          inline: false,
        });
    }

    await interaction.update({
      components: disabledRows,
      embeds: originalEmbed ? [originalEmbed] : originalMessage.embeds,
    });

    await interaction.followUp({
      content: "✅ Report dismissed.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!targetMember) {
    await interaction.reply({
      content: "❌ Target member is no longer in this server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (
    interaction.guild.ownerId !== interaction.user.id &&
    targetMember.roles.highest.position >= staffMember.roles.highest.position
  ) {
    await interaction.reply({
      content: "❌ You cannot punish this member because their role is equal to or higher than yours.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    switch (action) {
      case "timeout": {
        let kickedVc = false;
        if (targetMember.voice.channel) {
          await targetMember.voice.disconnect(`VC Report Penalty (by ${interaction.user.tag})`).catch(() => {});
          kickedVc = true;
        }

        if (targetMember.moderatable) {
          await targetMember.timeout(5 * 60 * 1000, `VC Report: Abusive language in Voice (by ${interaction.user.tag})`);
        }

        addPunishment({
          guildId: interaction.guild.id,
          userId: targetMember.id,
          username: targetMember.user.tag,
          kind: "timeout",
          reason: `VC Abuse Report resolved by staff: ${interaction.user.tag}`,
          durationDays: 5 / (24 * 60),
          staffId: interaction.user.id,
          staffTag: interaction.user.tag,
        });

        // DM to offender
        try {
          const dmEmbed = new EmbedBuilder()
            .setColor(BRAND.colors.danger)
            .setTitle("⚠️ You were Timed Out for Voice Channel Abuse")
            .setDescription(
              `You have been placed in a **5-minute timeout** in **${interaction.guild.name}** following a verified voice channel abuse report.`
            )
            .setFooter({ text: `${BRAND.name} Moderation` })
            .setTimestamp();
          await targetMember.send({ embeds: [dmEmbed] });
        } catch {}

        if (originalEmbed) {
          originalEmbed
            .setColor(BRAND.colors.danger)
            .addFields({
              name: "Resolution",
              value: `🔨 **Penalized** by ${interaction.user} (\`${interaction.user.tag}\`)\n` +
                `• **Action:** \`5-Minute Timeout\`${kickedVc ? " + `Kicked from VC`" : ""}`,
              inline: false,
            });
        }

        await interaction.update({
          components: disabledRows,
          embeds: originalEmbed ? [originalEmbed] : originalMessage.embeds,
        });

        await interaction.followUp({
          content: `✅ **Success:** **${targetMember.user.tag}** was timed out for 5 minutes${kickedVc ? " and kicked from the voice channel" : ""}.`,
          flags: MessageFlags.Ephemeral,
        });
        break;
      }

      case "kick": {
        if (!targetMember.voice.channel) {
          await interaction.reply({
            content: `⚠️ **${targetMember.user.tag}** is not currently inside any Voice Channel.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const vcName = targetMember.voice.channel.name;
        await targetMember.voice.disconnect(`VC Report Disconnect (by ${interaction.user.tag})`);

        addPunishment({
          guildId: interaction.guild.id,
          userId: targetMember.id,
          username: targetMember.user.tag,
          kind: "kick",
          reason: `VC Disconnect resolved by staff: ${interaction.user.tag}`,
          durationDays: null,
          staffId: interaction.user.id,
          staffTag: interaction.user.tag,
        });

        if (originalEmbed) {
          originalEmbed
            .setColor(BRAND.colors.warning)
            .addFields({
              name: "Resolution",
              value: `🚪 **Disconnected** from #${vcName} by ${interaction.user} (\`${interaction.user.tag}\`)`,
              inline: false,
            });
        }

        await interaction.update({
          components: disabledRows,
          embeds: originalEmbed ? [originalEmbed] : originalMessage.embeds,
        });

        await interaction.followUp({
          content: `✅ **Success:** **${targetMember.user.tag}** was disconnected from **#${vcName}**.`,
          flags: MessageFlags.Ephemeral,
        });
        break;
      }

      case "mute": {
        if (!targetMember.voice.channel) {
          await interaction.reply({
            content: `⚠️ **${targetMember.user.tag}** is not currently inside any Voice Channel.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await targetMember.voice.setMute(true, `VC Report Server Mute (by ${interaction.user.tag})`);

        if (originalEmbed) {
          originalEmbed
            .setColor(BRAND.colors.warning)
            .addFields({
              name: "Resolution",
              value: `🔇 **Server-Muted** by ${interaction.user} (\`${interaction.user.tag}\`)`,
              inline: false,
            });
        }

        await interaction.update({
          components: disabledRows,
          embeds: originalEmbed ? [originalEmbed] : originalMessage.embeds,
        });

        await interaction.followUp({
          content: `✅ **Success:** **${targetMember.user.tag}** was server-muted in voice.`,
          flags: MessageFlags.Ephemeral,
        });
        break;
      }
    }
  } catch (err: any) {
    console.error("[handleVoiceReportButton:error]", err);
    await interaction.followUp({
      content: `❌ Failed to execute action: ${err.message || "Unknown error"}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}
