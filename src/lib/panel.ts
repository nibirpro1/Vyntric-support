import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
} from "discord.js";
import { TICKET_TYPES, TicketType } from "../config/tickets";
import { BRAND, getBrandBanner, section, vyntricEmbed } from "./brand";
import { IDS } from "./customIds";
import { TicketPriority, TicketRecord } from "./store";

export const PRIORITY_META: Record<
  TicketPriority,
  { emoji: string; label: string; tone: "success" | "accent" | "warning" | "danger" }
> = {
  low: { emoji: "🟢", label: "Low", tone: "success" },
  normal: { emoji: "🔵", label: "Normal", tone: "accent" },
  high: { emoji: "🟠", label: "High", tone: "warning" },
  urgent: { emoji: "🔴", label: "Urgent", tone: "danger" },
};

/** The premium panel every member sees in the support channel. */
export function buildPanelEmbed() {
  const embed = vyntricEmbed("primary")
    .setTitle(`📩 ${BRAND.name} Support • Ticket Desk`)
    .setDescription(
      [
        `Welcome to **${BRAND.name} Support** — the fastest way to reach our team.`,
        "",
        section("How it works"),
        "`01`  Press the button that matches your request",
        "`02`  Fill in the private form (nobody else can see it)",
        "`03`  A private ticket opens with our team pinged",
        "`04`  A staff member claims it and handles you personally",
        "",
        section("Good to know"),
        "🔒 One open ticket per member — everything stays between you and staff.",
        "📄 Every ticket is archived with a full transcript.",
        "⭐ Rate the support after closing and help us improve.",
      ].join("\n")
    )
    .addFields(
      TICKET_TYPES.map((type) => ({
        name: `${type.emoji} ${type.label}`,
        value: [`> ${type.blurb}`, `-# ${type.promise}`].join("\n"),
      }))
    );

  const banner = getBrandBanner();
  if (banner) embed.setImage(banner);
  return embed;
}

/** One button per ticket type. */
export function buildPanelRows() {
  const buttons = TICKET_TYPES.slice(0, 5).map((type) =>
    new ButtonBuilder()
      .setCustomId(IDS.openTicket(type.id))
      .setLabel(type.label)
      .setEmoji(type.emoji)
      .setStyle(type.buttonStyle)
  );

  return [new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons)];
}

/** Type-specific private form (max 5 questions, enforced in config). */
export function buildTicketModal(type: TicketType) {
  const modal = new ModalBuilder()
    .setCustomId(IDS.ticketForm(type.id))
    .setTitle(`${type.label} • Vyntric`.slice(0, 45));

  modal.addComponents(
    ...type.answers.slice(0, 5).map((answer) =>
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(answer.id)
          .setLabel(answer.label.slice(0, 45))
          .setPlaceholder(answer.placeholder.slice(0, 100))
          .setStyle(answer.style)
          .setMaxLength(answer.maxLength)
          .setRequired(answer.required)
      )
    )
  );

  return modal;
}

/** Header embed pinned at the top of every ticket channel. */
export function buildTicketHeaderEmbed(ticket: TicketRecord, type: TicketType, ownerTag: string) {
  const priority = PRIORITY_META[ticket.priority];

  return new EmbedBuilder()
    .setColor(ticket.status === "open" ? type.color : BRAND.colors.neutral)
    .setAuthor({ name: `${BRAND.name} • Ticket #${ticket.number.toString().padStart(4, "0")}` })
    .setTitle(`${type.emoji} ${type.label}`)
    .setDescription(
      [
        section("Requester"),
        `**Member:** <@${ticket.ownerId}> (\`${ownerTag}\`)`,
        `**Opened:** <t:${Math.floor(ticket.createdAt / 1000)}:F>`,
        `**Priority:** ${priority.emoji} ${priority.label}`,
        `**Status:** ${ticket.status === "open" ? "🟢 Open" : "🔒 Closed"}`,
        `**Claimed by:** ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : "*waiting for staff*"}`,
        "",
        section("Submitted details"),
        ...type.answers
          .filter((answer) => ticket.answers[answer.id])
          .map(
            (answer) =>
              `**${answer.label}**\n> ${String(ticket.answers[answer.id]).replace(/\n/g, "\n> ")}`
          ),
        "",
        `*${type.sla}*`,
      ].join("\n")
    )
    .setFooter({ text: BRAND.footer })
    .setTimestamp();
}

/** Claim / transcript / close buttons plus the priority menu. */
export function buildTicketControlRows(ticket: TicketRecord) {
  const claimed = Boolean(ticket.claimedBy);

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(IDS.claim)
      .setLabel(claimed ? "Unclaim" : "Claim")
      .setEmoji(claimed ? "↩️" : "🖐️")
      .setStyle(claimed ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(ticket.status !== "open"),
    new ButtonBuilder()
      .setCustomId(IDS.transcript)
      .setLabel("Transcript")
      .setEmoji("📄")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(IDS.close)
      .setLabel("Close")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(ticket.status !== "open")
  );

  const priority = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(IDS.priority)
      .setPlaceholder(`Priority: ${PRIORITY_META[ticket.priority].label}`)
      .addOptions(
        (Object.keys(PRIORITY_META) as TicketPriority[]).map((key) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(PRIORITY_META[key].label)
            .setValue(key)
            .setEmoji(PRIORITY_META[key].emoji)
            .setDefault(key === ticket.priority)
        )
      )
  );

  return [buttons, priority];
}

/** Shown in the channel after a ticket is closed. */
export function buildClosedRows(ticket: TicketRecord) {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(IDS.reopen)
        .setLabel("Reopen")
        .setEmoji("🔓")
        .setStyle(ButtonStyle.Success)
        .setDisabled(ticket.status === "open"),
      new ButtonBuilder()
        .setCustomId(IDS.transcript)
        .setLabel("Transcript")
        .setEmoji("📄")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(IDS.delete)
        .setLabel("Delete channel")
        .setEmoji("🗑️")
        .setStyle(ButtonStyle.Danger)
    ),
  ];
}

/** 1-5 star feedback row, sent to the member's DM after closing. */
export function buildRatingRow(ticket: TicketRecord) {
  const labels: Record<number, string> = {
    1: "1 ★",
    2: "2 ★★",
    3: "3 ★★★",
    4: "4 ★★★★",
    5: "5 ★★★★★",
  };

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    [1, 2, 3, 4, 5].map((stars) =>
      new ButtonBuilder()
        .setCustomId(IDS.rating(ticket.id, stars))
        .setLabel(labels[stars])
        .setStyle(
          stars >= 4 ? ButtonStyle.Success : stars === 3 ? ButtonStyle.Primary : ButtonStyle.Secondary
        )
    )
  );
}

