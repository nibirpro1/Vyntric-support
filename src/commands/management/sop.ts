import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { Command } from "../../structures/Command";
import { VyntricClient } from "../../structures/VyntricClient";
import { vyntricEmbed, section } from "../../lib/brand";
import { isTicketStaff } from "../../lib/permissions";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("sop")
    .setDescription("Display Vyntric Staff Standard Operating Procedures (SOP)")
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .addStringOption((opt) =>
      opt
        .setName("category")
        .setDescription("SOP topic to view")
        .setRequired(false)
        .addChoices(
          { name: "All / Overview", value: "overview" },
          { name: "Ticket Protocol & SLAs", value: "tickets" },
          { name: "Punishment Ladder & Proofs", value: "punishments" },
          { name: "Staff Code of Conduct", value: "conduct" }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction, _client: VyntricClient) {
    if (!interaction.guild || !interaction.member) return;
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member || !isTicketStaff(member)) {
      await interaction.reply({
        content: "🛡️ Only Vyntric staff members can access the internal SOP guidelines.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const cat = interaction.options.getString("category") || "overview";

    if (cat === "tickets") {
      const embed = vyntricEmbed("primary")
        .setTitle("📩 SOP: Ticket Handling & SLA Protocol")
        .setDescription(
          `${section("1. Response Time Expectations (SLA)")}\n` +
            `• **First Response:** Within 15 minutes during active daytime hours.\n` +
            `• **Claim Reward:** Verified and closed within 24 hours.\n` +
            `• **Team Applications:** Reviewed within 72 hours.\n` +
            `• **General Help:** Resolved within 48 hours.\n\n` +
            `${section("2. Ticket Communication Rules")}\n` +
            `• Always be polite, professional, and patient.\n` +
            `• Greet the player: _"Hello! Thank you for reaching out to Vyntric Support."_\n` +
            `• Never argue or engage in toxicity in a ticket.\n` +
            `• Claim a ticket before working on it so teammates don't duplicate work.\n` +
            `• Always provide a clear closing reason before closing the ticket.`
        );
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (cat === "punishments") {
      const embed = vyntricEmbed("danger")
        .setTitle("⚖️ SOP: Punishment Escalation & Proof Standards")
        .setDescription(
          `${section("1. The Punishment Ladder")}\n` +
            `1️⃣ **First Offense (Minor):** Verbal warning or official \`/warn\`\n` +
            `2️⃣ **Second Offense:** Temporary mute (1h - 24h)\n` +
            `3️⃣ **Third Offense:** Extended mute or temporary ban (1 - 7 days)\n` +
            `4️⃣ **Major Offense (Hacking / Cheating / Dox / Threat):** Immediate Ban + Proof\n\n` +
            `${section("2. Proof Requirements (MANDATORY)")}\n` +
            `• **NO BAN WITHOUT PROOF:** You must record clear video or uncropped screenshots.\n` +
            `• Use \`/proof add\` to store the evidence into the audit log.\n` +
            `• Keep video clips at minimum 720p 30fps showing the player's full username.`
        );
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (cat === "conduct") {
      const embed = vyntricEmbed("accent")
        .setTitle("🛡️ SOP: Staff Code of Conduct")
        .setDescription(
          `${section("Core Rules for Staff")}\n` +
            `• **No Power Abuse:** Never use staff commands, permissions, or in-game perks for personal gain.\n` +
            `• **Confidentiality:** Staff chats, dev logs, internal discussions, and user IP/dox data are strictly confidential.\n` +
            `• **Impartiality:** Treat all players equally, regardless of whether they are your friends or rivals.\n` +
            `• **Activity:** Maintain your minimum agreed active hours. If taking leave, inform management in advance.\n` +
            `• **Chain of Command:** Escalate unresolvable disputes to the Head Admin or Owner.`
        );
      await interaction.reply({ embeds: [embed] });
      return;
    }

    // Default overview
    const embed = vyntricEmbed("primary")
      .setTitle("📋 Vyntric Staff Standard Operating Procedures (SOP)")
      .setDescription(
        `Welcome to the official Vyntric Staff SOP quick-reference guide.\n\n` +
          `**Available Topics:**\n` +
          `• \`/sop category:tickets\` - Ticket handling, greeting templates, and SLA response times.\n` +
          `• \`/sop category:punishments\` - Step-by-step punishment ladder and mandatory proof standards.\n` +
          `• \`/sop category:conduct\` - Staff rules, anti-abuse policies, and confidentiality.\n\n` +
          `💡 _Detailed handbook and full rules are documented in the team guidelines._`
      );
    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
