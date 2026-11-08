import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { Command } from "../../structures/Command";
import { VyntricClient } from "../../structures/VyntricClient";
import { isTicketStaff } from "../../lib/permissions";
import { vyntricEmbed, section } from "../../lib/brand";
import { addStaffProof, listStaffProofs, ProofType, getSettings } from "../../lib/store";

const PROOF_EMOJIS: Record<ProofType, string> = {
  ban: "🔨 Ban Proof",
  mute: "🔇 Mute Proof",
  kick: "👢 Kick Proof",
  warn: "⚠️ Warning Proof",
  other: "📁 General Evidence",
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("proof")
    .setDescription("Vyntric Staff evidence & punishment proof logger")
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Log punishment proof/evidence for a player")
        .addStringOption((opt) =>
          opt
            .setName("target")
            .setDescription("Player IGN, username, or Discord ID")
            .setRequired(true)
            .setMaxLength(80)
        )
        .addStringOption((opt) =>
          opt
            .setName("type")
            .setDescription("Punishment type")
            .setRequired(true)
            .addChoices(
              { name: "Ban", value: "ban" },
              { name: "Mute", value: "mute" },
              { name: "Kick", value: "kick" },
              { name: "Warning", value: "warn" },
              { name: "Other", value: "other" }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName("evidence")
            .setDescription("Image URL, video clip link, or detailed description")
            .setRequired(true)
            .setMaxLength(500)
        )
        .addStringOption((opt) =>
          opt
            .setName("reason")
            .setDescription("Rule violation / reason")
            .setRequired(false)
            .setMaxLength(250)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("View logged proofs")
        .addStringOption((opt) =>
          opt
            .setName("target")
            .setDescription("Filter by player name or ID")
            .setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction, _client: VyntricClient) {
    if (!interaction.guild || !interaction.member) return;
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member || !isTicketStaff(member)) {
      await interaction.reply({
        content: "🛡️ Only Vyntric staff members can access punishment proof logs.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "add") {
      const target = interaction.options.getString("target", true);
      const type = interaction.options.getString("type", true) as ProofType;
      const evidence = interaction.options.getString("evidence", true);
      const reason = interaction.options.getString("reason") || "Violation of Vyntric Rules";

      const record = addStaffProof({
        guildId: interaction.guild.id,
        target,
        type,
        evidence,
        reason,
        staffId: interaction.user.id,
        staffTag: interaction.user.tag,
      });

      const embed = vyntricEmbed("danger")
        .setTitle(`🛡️ Staff Proof Logged: ${record.id}`)
        .setDescription(
          `${section("Evidence Details")}\n` +
            `• **Target:** \`${record.target}\`\n` +
            `• **Punishment Type:** ${PROOF_EMOJIS[record.type]}\n` +
            `• **Reason:** ${record.reason}\n` +
            `• **Evidence Link / Details:** ${record.evidence}\n` +
            `• **Logged By:** <@${record.staffId}>\n` +
            `• **Date:** <t:${Math.floor(record.createdAt / 1000)}:f>`
        );

      await interaction.reply({ embeds: [embed] });

      // Forward to staff log channel if configured
      const settings = getSettings(interaction.guild.id);
      if (settings.staffLogChannelId && settings.staffLogChannelId !== interaction.channelId) {
        const logChan = interaction.guild.channels.cache.get(settings.staffLogChannelId);
        if (logChan && logChan.isTextBased()) {
          await logChan.send({ embeds: [embed] }).catch(() => null);
        }
      }
      return;
    }

    if (sub === "list") {
      const targetFilter = interaction.options.getString("target");
      const proofs = listStaffProofs(interaction.guild.id, targetFilter || undefined);

      if (proofs.length === 0) {
        await interaction.reply({
          content: "📁 No proof records found.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const lines = proofs.slice(0, 10).map((p) => {
        return `\`${p.id}\` **${p.target}** (${PROOF_EMOJIS[p.type]})\n↳ Reason: ${p.reason}\n↳ Evidence: ${p.evidence}\n↳ By: <@${p.staffId}> on <t:${Math.floor(p.createdAt / 1000)}:d>`;
      });

      const embed = vyntricEmbed("primary")
        .setTitle("📁 Vyntric Staff Proof Archive")
        .setDescription(
          `${section("Logged Proofs")}\n` +
            lines.join("\n\n") +
            (proofs.length > 10 ? `\n\n_...and ${proofs.length - 10} more records._` : "")
        );

      await interaction.reply({ embeds: [embed] });
      return;
    }
  },
};

export default command;
