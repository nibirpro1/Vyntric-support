import {
  ActionRowBuilder,
  ButtonInteraction,
  GuildMember,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { VyntricClient } from "../structures/VyntricClient";
import { findTicketType } from "../config/tickets";
import { section, vyntricEmbed } from "../lib/brand";
import { IDS, isTicketCustomId, parseRatingId } from "../lib/customIds";
import { PRIORITY_META, buildTicketModal } from "../lib/panel";
import { buildTranscript } from "../lib/transcript";
import {
  closeTicket,
  deleteTicket,
  logTicketEvent,
  openTicket,
  recordRating,
  refreshTicketHeader,
  reopenTicket,
  starString,
} from "../lib/tickets";
import {
  TicketPriority,
  findOpenTicketOfType,
  findTicketByChannel,
  getTicket,
  updateTicket,
} from "../lib/store";
import { isTicketStaff, padTicketNumber } from "../lib/permissions";

type Repliable = ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction;

/** Ephemeral refusal that works whether the interaction was acknowledged or not. */
export async function deny(interaction: Repliable, content: string) {
  const payload = { content, flags: MessageFlags.Ephemeral } as const;
  return interaction.replied || interaction.deferred
    ? interaction.followUp(payload)
    : interaction.reply(payload);
}

/** Panel button pressed -> type-specific private form. */
export async function handleOpenTicketButton(interaction: ButtonInteraction) {
  const typeId = interaction.customId.slice(IDS.openPrefix.length);
  const type = findTicketType(typeId);
  if (!type || !interaction.guild) {
    await deny(interaction, "This ticket type is no longer available.");
    return;
  }

  const existing = findOpenTicketOfType(interaction.guild.id, interaction.user.id, type.id);
  if (existing) {
    await deny(
      interaction,
      `You already have an open **${type.label}** ticket: <#${existing.channelId}>`
    );
    return;
  }

  await interaction.showModal(buildTicketModal(type));
}

/** Form submitted -> private ticket channel. */
export async function handleTicketFormSubmit(interaction: ModalSubmitInteraction) {
  const typeId = interaction.customId.slice(IDS.formPrefix.length);
  const type = findTicketType(typeId);
  if (!type || !interaction.guild) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const member = interaction.member as GuildMember;

  const existing = findOpenTicketOfType(interaction.guild.id, member.id, type.id);
  if (existing) {
    await interaction.editReply({
      content: `You already have an open **${type.label}** ticket: <#${existing.channelId}>`,
    });
    return;
  }

  const answers: Record<string, string> = {};
  for (const question of type.answers) {
    try {
      const value = interaction.fields.getTextInputValue(question.id);
      if (value) answers[question.id] = value.trim().slice(0, question.maxLength);
    } catch {
      /* optional question left empty */
    }
  }

  const { channel, ticket } = await openTicket({
    guild: interaction.guild,
    member,
    type,
    answers,
  });

  await interaction.editReply({
    embeds: [
      vyntricEmbed("success")
        .setTitle(`${type.emoji} Ticket #${padTicketNumber(ticket.number)} created`)
        .setDescription(
          [
            `Your private channel is ready: <#${channel.id}>`,
            "",
            section("Next steps"),
            "Add screenshots / clips or extra context right there",
            "A Vyntric staff member claims your ticket shortly",
            `-# ${type.sla}`,
          ].join("\n")
        ),
    ],
  });
}

/** Close button -> reason modal. */
export async function handleClosePrompt(interaction: ButtonInteraction) {
  if (!interaction.guild) return;

  const ticket = findTicketByChannel(interaction.channelId);
  if (!ticket) {
    await deny(interaction, "This channel is not a Vyntric ticket.");
    return;
  }
  if (ticket.status !== "open") {
    await deny(interaction, "This ticket is already closed.");
    return;
  }

  const isStaff = isTicketStaff(interaction.member as GuildMember);
  if (!isStaff && interaction.user.id !== ticket.ownerId) {
    await deny(interaction, "Only the ticket owner or Vyntric staff can close this ticket.");
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(IDS.closeForm)
    .setTitle(`Close ticket #${padTicketNumber(ticket.number)}`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("Reason for closing")
          .setPlaceholder("e.g. reward delivered, application accepted, deal signed")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(400)
          .setRequired(true)
      )
    );

  await interaction.showModal(modal);
}

/** Close modal submitted -> transcript, archive, log, DM rating request. */
export async function handleCloseSubmit(interaction: ModalSubmitInteraction) {
  if (!(interaction.channel instanceof TextChannel) || !interaction.guild) return;

  const ticket = findTicketByChannel(interaction.channel.id);
  if (!ticket) {
    await deny(interaction, "This channel is not a Vyntric ticket.");
    return;
  }
  if (ticket.status !== "open") {
    await deny(interaction, "This ticket is already closed.");
    return;
  }

  const isStaff = isTicketStaff(interaction.member as GuildMember);
  if (!isStaff && interaction.user.id !== ticket.ownerId) {
    await deny(interaction, "Only the ticket owner or Vyntric staff can close this ticket.");
    return;
  }

  await interaction.deferReply();
  const reason = interaction.fields.getTextInputValue("reason") || "No reason provided";

  const { ticket: closed } = await closeTicket({
    channel: interaction.channel,
    ticket,
    actorId: interaction.user.id,
    actorTag: interaction.user.tag,
    reason,
  });

  await interaction.editReply({
    embeds: [
      vyntricEmbed("danger")
        .setTitle(`🔒 Ticket #${padTicketNumber(closed.number)} closed`)
        .setDescription("Transcript generated and posted to the log channel."),
    ],
  });
}

/** Claim / unclaim the ticket for the staff member who pressed the button. */
export async function handleClaimToggle(interaction: ButtonInteraction) {
  if (!interaction.guild) return;

  const ticket = findTicketByChannel(interaction.channelId);
  if (!ticket) {
    await deny(interaction, "This channel is not a Vyntric ticket.");
    return;
  }
  if (!isTicketStaff(interaction.member as GuildMember)) {
    await deny(interaction, "Only Vyntric staff can claim tickets.");
    return;
  }
  if (ticket.status !== "open") {
    await deny(interaction, "Reopen the ticket before claiming it.");
    return;
  }

  const unclaiming = ticket.claimedBy === interaction.user.id;
  const updated =
    updateTicket(ticket.id, { claimedBy: unclaiming ? null : interaction.user.id }) ?? ticket;

  if (interaction.channel instanceof TextChannel) {
    const owner = await interaction.guild.members.fetch(ticket.ownerId).catch(() => null);
    await refreshTicketHeader(interaction.channel, updated, owner?.user.tag ?? ticket.ownerId);
  }

  await logTicketEvent(interaction.guild, unclaiming ? "↩️ Ticket Unclaimed" : "🖐️ Ticket Claimed", [
    `**Ticket:** #${padTicketNumber(ticket.number)}`,
    `**Member:** <@${ticket.ownerId}>`,
    `**Staff:** ${interaction.user}`,
  ]);

  await interaction.reply({
    embeds: [
      vyntricEmbed(unclaiming ? "neutral" : "success")
        .setTitle(unclaiming ? "↩️ Ticket Unclaimed" : "🖐️ Ticket Claimed")
        .setDescription(
          unclaiming
            ? "This ticket is back in the queue for any staff member."
            : `${interaction.user} is now handling <@${ticket.ownerId}>.`
        ),
    ],
  });
}

/** Priority select menu (staff only). */
export async function handlePrioritySelect(interaction: StringSelectMenuInteraction) {
  if (!interaction.guild) return;

  const ticket = findTicketByChannel(interaction.channelId);
  if (!ticket) {
    await deny(interaction, "This channel is not a Vyntric ticket.");
    return;
  }
  if (!isTicketStaff(interaction.member as GuildMember)) {
    await deny(interaction, "Only Vyntric staff can change the priority.");
    return;
  }

  const priority = interaction.values[0] as TicketPriority;
  if (!PRIORITY_META[priority]) {
    await deny(interaction, "That priority level does not exist.");
    return;
  }

  const updated = updateTicket(ticket.id, { priority }) ?? ticket;

  if (interaction.channel instanceof TextChannel) {
    const owner = await interaction.guild.members.fetch(ticket.ownerId).catch(() => null);
    await refreshTicketHeader(interaction.channel, updated, owner?.user.tag ?? ticket.ownerId);
  }

  const meta = PRIORITY_META[priority];
  await logTicketEvent(interaction.guild, "⚙️ Priority Updated", [
    `**Ticket:** #${padTicketNumber(ticket.number)}`,
    `**Priority:** ${meta.emoji} ${meta.label}`,
    `**Staff:** ${interaction.user}`,
  ]);

  await interaction.reply({
    embeds: [
      vyntricEmbed(meta.tone)
        .setTitle("⚙️ Priority Updated")
        .setDescription(`Ticket #${padTicketNumber(ticket.number)} is now **${meta.emoji} ${meta.label}**.`),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

/** Manual transcript download (owner + staff). */
export async function handleTranscriptRequest(interaction: ButtonInteraction) {
  if (!interaction.guild || !(interaction.channel instanceof TextChannel)) return;

  const ticket = findTicketByChannel(interaction.channel.id);
  if (!ticket) {
    await deny(interaction, "This channel is not a Vyntric ticket.");
    return;
  }

  const isStaff = isTicketStaff(interaction.member as GuildMember);
  if (!isStaff && interaction.user.id !== ticket.ownerId) {
    await deny(interaction, "Only the ticket owner or Vyntric staff can download the transcript.");
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const transcript = await buildTranscript(interaction.channel, ticket);

  await interaction.editReply({
    embeds: [
      vyntricEmbed("accent")
        .setTitle(`📄 Transcript • Ticket #${padTicketNumber(ticket.number)}`)
        .setDescription(
          [
            `**Channel:** #${ticket.channelName}`,
            `**Messages captured:** \`${transcript.messageCount}\``,
            `**Participants:** \`${transcript.participants.length}\``,
            "",
            "HTML and TXT copies are attached.",
          ].join("\n")
        ),
    ],
    files: [transcript.html, transcript.txt],
  });

  await logTicketEvent(interaction.guild, "📄 Transcript Requested", [
    `**Ticket:** #${padTicketNumber(ticket.number)}`,
    `**Requested by:** ${interaction.user}`,
  ]);
}

/** Reopen a closed ticket (staff only). */
export async function handleReopen(interaction: ButtonInteraction) {
  if (!interaction.guild || !(interaction.channel instanceof TextChannel)) return;

  const ticket = findTicketByChannel(interaction.channel.id);
  if (!ticket) {
    await deny(interaction, "This channel is not a Vyntric ticket.");
    return;
  }
  if (!isTicketStaff(interaction.member as GuildMember)) {
    await deny(interaction, "Only Vyntric staff can reopen tickets.");
    return;
  }
  if (ticket.status === "open") {
    await deny(interaction, "This ticket is already open.");
    return;
  }

  await interaction.deferReply();
  const reopened = await reopenTicket({
    channel: interaction.channel,
    ticket,
    actor: interaction.member as GuildMember,
  });

  await interaction.editReply({
    embeds: [
      vyntricEmbed("success")
        .setTitle(`🔓 Ticket #${padTicketNumber(reopened.number)} reopened`)
        .setDescription(`<@${reopened.ownerId}> can talk in this channel again.`),
    ],
  });
}

/** Permanently delete the ticket channel (staff only). */
export async function handleDelete(interaction: ButtonInteraction) {
  if (!interaction.guild || !(interaction.channel instanceof TextChannel)) return;

  const ticket = findTicketByChannel(interaction.channel.id);
  if (!ticket) {
    await deny(interaction, "This channel is not a Vyntric ticket.");
    return;
  }
  if (!isTicketStaff(interaction.member as GuildMember)) {
    await deny(interaction, "Only Vyntric staff can delete ticket channels.");
    return;
  }

  await interaction.reply({
    embeds: [
      vyntricEmbed("danger")
        .setTitle("🗑️ Deleting Channel")
        .setDescription(
          [
            `Ticket #${padTicketNumber(ticket.number)} is being removed.`,
            "A final log entry is written before the channel disappears (5 seconds).",
          ].join("\n")
        ),
    ],
  });

  const channel = interaction.channel;
  const actorTag = interaction.user.tag;
  setTimeout(() => {
    void deleteTicket(channel, ticket, actorTag);
  }, 5000);
}

/** Star rating pressed in the member's DM. */
export async function handleRating(interaction: ButtonInteraction, client: VyntricClient) {
  const parsed = parseRatingId(interaction.customId);
  if (!parsed) return;

  const ticket = getTicket(parsed.ticketId);
  if (!ticket) {
    await deny(interaction, "This ticket no longer exists.");
    return;
  }
  if (ticket.ownerId !== interaction.user.id) {
    await deny(interaction, "Only the ticket owner can rate this ticket.");
    return;
  }

  const guild = client.guilds.cache.get(ticket.guildId);
  if (!guild) {
    await deny(interaction, "The Vyntric server is unavailable right now.");
    return;
  }

  await recordRating(guild, ticket, parsed.stars, interaction.user.id);

  await interaction.update({
    embeds: [
      vyntricEmbed(parsed.stars >= 4 ? "success" : parsed.stars === 3 ? "warning" : "danger")
        .setTitle(`${starString(parsed.stars)} Thanks for the feedback!`)
        .setDescription(
          parsed.stars >= 4
            ? "Our team is happy to hear that. See you around 💜"
            : "Thank you — your rating went straight to Vyntric management."
        ),
    ],
    components: [],
  });
}

/**
 * Single entry point for every ticket component.
 * Returns true when the interaction belonged to Vyntric Support.
 */
export async function handleTicketComponent(
  interaction: ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction,
  client: VyntricClient
): Promise<boolean> {
  const { customId } = interaction;
  if (!isTicketCustomId(customId)) return false;

  if (interaction.isButton()) {
    if (customId.startsWith(IDS.openPrefix)) {
      await handleOpenTicketButton(interaction);
      return true;
    }
    if (customId.startsWith(IDS.ratingPrefix)) {
      await handleRating(interaction, client);
      return true;
    }

    switch (customId) {
      case IDS.claim:
        await handleClaimToggle(interaction);
        return true;
      case IDS.transcript:
        await handleTranscriptRequest(interaction);
        return true;
      case IDS.close:
        await handleClosePrompt(interaction);
        return true;
      case IDS.reopen:
        await handleReopen(interaction);
        return true;
      case IDS.delete:
        await handleDelete(interaction);
        return true;
      default:
        return false;
    }
  }

  if (interaction.isStringSelectMenu()) {
    if (customId === IDS.priority) {
      await handlePrioritySelect(interaction);
      return true;
    }
    return false;
  }

  if (interaction.isModalSubmit()) {
    if (customId.startsWith(IDS.formPrefix)) {
      await handleTicketFormSubmit(interaction);
      return true;
    }
    if (customId === IDS.closeForm) {
      await handleCloseSubmit(interaction);
      return true;
    }
  }

  return false;
}



