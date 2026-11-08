import {
  AttachmentBuilder,
  ChannelType,
  Guild,
  GuildMember,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import { TicketType, findTicketType } from "../config/tickets";
import { BRAND, section, vyntricEmbed } from "./brand";
import {
  PRIORITY_META,
  buildClosedRows,
  buildRatingRow,
  buildTicketControlRows,
  buildTicketHeaderEmbed,
} from "./panel";
import { buildTranscript } from "./transcript";
import {
  TicketPriority,
  TicketRecord,
  createTicket,
  getSettings,
  nextTicketNumber,
  updateTicket,
} from "./store";
import {
  padTicketNumber,
  resolveArchiveCategory,
  resolveLogChannel,
  resolveTicketCategory,
  staffMentions,
} from "./permissions";

const STAFF_PERMS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.AddReactions,
];

const OWNER_PERMS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AddReactions,
];

/** Denies that silence every other bot inside a ticket channel. */
const BLOCKED_BOT_PERMS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.SendMessagesInThreads,
  PermissionFlagsBits.CreatePublicThreads,
  PermissionFlagsBits.CreatePrivateThreads,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AddReactions,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.UseApplicationCommands,
  PermissionFlagsBits.UseExternalEmojis,
  PermissionFlagsBits.UseExternalStickers,
];

/**
 * Overwrites that lock every other bot out of a ticket channel, so only
 * Plugsy (and staff) can see or answer anything in there.
 * Denies bot integration roles, generic 'bot' roles, and individual bot member accounts.
 */
function blockedBotOverwrites(guild: Guild, meId: string) {
  const overwrites: { id: string; deny: bigint[] }[] = [];
  const addedIds = new Set<string>();

  // 1. Block every bot integration role (e.g. Carl-bot, Dyno, OwO) and generic "bot" roles
  for (const role of guild.roles.cache.values()) {
    const isBotRole = Boolean(role.tags?.botId && role.tags.botId !== meId);
    const isGenericBotRole = role.name.toLowerCase() === "bot" || role.name.toLowerCase() === "bots";
    if ((isBotRole || isGenericBotRole) && !addedIds.has(role.id)) {
      overwrites.push({ id: role.id, deny: BLOCKED_BOT_PERMS });
      addedIds.add(role.id);
    }
  }

  // 2. Explicitly block every other bot member in the server
  for (const member of guild.members.cache.values()) {
    if (member.user.bot && member.id !== meId && !addedIds.has(member.id)) {
      overwrites.push({ id: member.id, deny: BLOCKED_BOT_PERMS });
      addedIds.add(member.id);
    }
  }

  return overwrites;
}

/** Creates the private channel, the pinned header and logs the opening. */
export async function openTicket(options: {
  guild: Guild;
  member: GuildMember;
  type: TicketType;
  answers: Record<string, string>;
}) {
  const { guild, member, type, answers } = options;
  const settings = getSettings(guild.id);
  const category = await resolveTicketCategory(guild, settings);
  const number = nextTicketNumber(guild.id);
  const padded = padTicketNumber(number);
  const me = guild.members.me ?? (await guild.members.fetchMe());

  const channel = (await guild.channels.create({
    name: `${type.channelPrefix}-${padded}`,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `${BRAND.name} • Ticket #${padded} • ${type.label} • ${member.user.tag} (${member.id})`,
    reason: `${BRAND.name} ticket #${padded} opened by ${member.user.tag}`,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: member.id, allow: OWNER_PERMS },
      { id: me.id, allow: [...STAFF_PERMS, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.PinMessages] },
      ...settings.staffRoleIds.map((roleId) => ({ id: roleId, allow: STAFF_PERMS })),
      // Every other bot loses access here — only Vyntric Support works in tickets.
      ...blockedBotOverwrites(guild, me.id),
    ],
  })) as TextChannel;

  const ticket = createTicket({
    guildId: guild.id,
    number,
    type: type.id,
    channelId: channel.id,
    channelName: channel.name,
    ownerId: member.id,
    answers,
    status: "open",
    priority: "normal",
    claimedBy: null,
    createdAt: Date.now(),
    closedAt: null,
    closedBy: null,
    closeReason: null,
    rating: null,
    headerMessageId: null,
    transcriptFile: null,
  });

  const header = await channel.send({
    content:
      [settings.pingStaff ? staffMentions(settings) : "", `<@${member.id}>`]
        .filter(Boolean)
        .join(" ")
        .trim() || undefined,
    embeds: [buildTicketHeaderEmbed(ticket, type, member.user.tag)],
    components: buildTicketControlRows(ticket),
  });
  await header.pin().catch(() => {});
  const stored = updateTicket(ticket.id, { headerMessageId: header.id }) ?? ticket;

  await channel
    .send({
      embeds: [
        vyntricEmbed("neutral")
          .setTitle("👋 Welcome to Vyntric Support")
          .setDescription(
            [
              `Thank you <@${member.id}> — your **${type.label}** ticket is open.`,
              "",
              `> ${type.promise}`,
              "",
              "Feel free to drop screenshots, clips or extra context right here.",
              `-# ${type.sla}`,
            ].join("\n")
          ),
      ],
    })
    .catch(() => {});

  await logTicketEvent(guild, "🎫 Ticket Opened", [
    `**Ticket:** #${padded} • ${type.emoji} ${type.label}`,
    `**Member:** <@${member.id}> (\`${member.user.tag}\`)`,
    `**Channel:** <#${channel.id}>`,
    `**Priority:** ${PRIORITY_META.normal.emoji} Normal`,
  ]);

  return { channel, ticket: stored, category };
}

/** Re-renders the pinned header whenever claim / priority / status changes. */
export async function refreshTicketHeader(
  channel: TextChannel,
  ticket: TicketRecord,
  ownerTag: string
) {
  const type = findTicketType(ticket.type);
  if (!type || !ticket.headerMessageId) return;

  const message = await channel.messages.fetch(ticket.headerMessageId).catch(() => null);
  if (!message) return;

  const settings = getSettings(ticket.guildId);
  const content = [
    staffMentions(settings),
    ticket.status === "open" && ticket.claimedBy
      ? `**Claimed by:** <@${ticket.claimedBy}>`
      : `**Ticket owner:** <@${ticket.ownerId}>`,
  ]
    .filter(Boolean)
    .join(" ");

  await message
    .edit({
      content: content || undefined,
      embeds: [buildTicketHeaderEmbed(ticket, type, ownerTag)],
      components: ticket.status === "open" ? buildTicketControlRows(ticket) : buildClosedRows(ticket),
    })
    .catch(() => {});
}

/** Sends an embed to the guild's ticket log channel (silently skips when unset). */
export async function logTicketEvent(
  guild: Guild,
  title: string,
  lines: string[],
  files: AttachmentBuilder[] = []
) {
  const settings = getSettings(guild.id);
  const channel = await resolveLogChannel(guild, settings);
  if (!channel) return;

  const body = lines.filter(Boolean).join("\n");
  await channel
    .send({
      embeds: [vyntricEmbed("neutral").setTitle(title).setDescription(body.slice(0, 4000))],
      files: files.length ? files : undefined,
    })
    .catch(() => {});
}

/** Close flow: transcript -> lock -> archive -> log -> DM with rating buttons. */
export async function closeTicket(options: {
  channel: TextChannel;
  ticket: TicketRecord;
  actorId: string;
  actorTag: string;
  reason: string;
}) {
  const { channel, ticket, actorId, actorTag, reason } = options;
  const guild = channel.guild;
  const settings = getSettings(guild.id);
  const type = findTicketType(ticket.type);
  const padded = padTicketNumber(ticket.number);

  const transcript = await buildTranscript(channel, ticket);

  const closed =
    updateTicket(ticket.id, {
      status: "closed",
      closedAt: Date.now(),
      closedBy: actorId,
      closeReason: reason,
      transcriptFile: transcript.savedPath,
    }) ?? ticket;

  await channel.permissionOverwrites
    .edit(ticket.ownerId, { SendMessages: false, AddReactions: false })
    .catch(() => {});

  const owner = await guild.members.fetch(ticket.ownerId).catch(() => null);
  const ownerTag = owner?.user.tag ?? ticket.ownerId;

  await channel
    .send({
      embeds: [
        vyntricEmbed("danger")
          .setTitle(`🔒 Ticket #${padded} Closed`)
          .setDescription(
            [
              `**Closed by:** ${actorTag}`,
              `**Reason:** ${reason}`,
              "",
              section("What happens now"),
              "🔓 Staff can reopen this ticket at any time",
              "📄 The full transcript was posted to the log channel",
              "⭐ The requester received a rating request in DM",
            ].join("\n")
          ),
      ],
      components: buildClosedRows(closed),
    })
    .catch(() => {});

  await refreshTicketHeader(channel, closed, ownerTag);

  if (settings.autoArchive) {
    const archive = await resolveArchiveCategory(guild, settings).catch(() => null);
    if (archive) await channel.setParent(archive.id, { lockPermissions: false }).catch(() => {});
  }

  await logTicketEvent(
    guild,
    "🔒 Ticket Closed",
    [
      `**Ticket:** #${padded} • ${type ? `${type.emoji} ${type.label}` : ticket.type}`,
      `**Member:** <@${ticket.ownerId}>`,
      `**Closed by:** <@${actorId}>`,
      `**Reason:** ${reason}`,
      `**Messages captured:** \`${transcript.messageCount}\``,
      `**Channel:** #${ticket.channelName}`,
    ],
    [transcript.html, transcript.txt]
  );

  if (settings.dmTranscript && owner) {
    await owner
      .send({
        embeds: [
          vyntricEmbed("neutral")
            .setTitle(`Your Vyntric ticket #${padded} was closed`)
            .setDescription(
              [
                `**Closed by:** ${actorTag}`,
                `**Reason:** ${reason}`,
                "",
                "A copy of the transcript is attached.",
                "How was our support? Rate it below 👇",
              ].join("\n")
            ),
        ],
        components: [buildRatingRow(closed)],
        files: [transcript.txt],
      })
      .catch(() => {});
  }

  return { ticket: closed, transcript };
}

/** Reopens a closed ticket and restores the requester's access. */
export async function reopenTicket(options: {
  channel: TextChannel;
  ticket: TicketRecord;
  actor: GuildMember;
}) {
  const { channel, ticket, actor } = options;
  const padded = padTicketNumber(ticket.number);

  const reopened =
    updateTicket(ticket.id, {
      status: "open",
      closedAt: null,
      closedBy: null,
      closeReason: null,
    }) ?? ticket;

  await channel.permissionOverwrites
    .edit(ticket.ownerId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AddReactions: true,
    })
    .catch(() => {});

  const owner = await channel.guild.members.fetch(ticket.ownerId).catch(() => null);

  await channel
    .send({
      embeds: [
        vyntricEmbed("success")
          .setTitle(`🔓 Ticket #${padded} Reopened`)
          .setDescription([`Reopened by ${actor}.`, "The requester can talk again."].join("\n")),
      ],
      components: buildTicketControlRows(reopened),
    })
    .catch(() => {});

  await refreshTicketHeader(channel, reopened, owner?.user.tag ?? ticket.ownerId);
  await logTicketEvent(channel.guild, "🔓 Ticket Reopened", [
    `**Ticket:** #${padded}`,
    `**Member:** <@${ticket.ownerId}>`,
    `**Reopened by:** ${actor}`,
  ]);

  return reopened;
}

/** Staff-only hard delete; a final log entry is written first. */
export async function deleteTicket(channel: TextChannel, ticket: TicketRecord, actorTag: string) {
  await logTicketEvent(channel.guild, "🗑️ Ticket Deleted", [
    `**Ticket:** #${padTicketNumber(ticket.number)} • #${ticket.channelName}`,
    `**Member:** <@${ticket.ownerId}>`,
    `**Deleted by:** ${actorTag}`,
  ]);

  await channel.delete(`Vyntric ticket #${ticket.number} deleted by ${actorTag}`).catch(() => {});
}

export function starString(stars: number) {
  const safe = Math.max(1, Math.min(5, Math.round(stars)));
  return `${"⭐".repeat(safe)}${"☆".repeat(5 - safe)}`;
}

/** Stores the member rating and mirrors it into the feedback channel. */
export async function recordRating(
  guild: Guild,
  ticket: TicketRecord,
  stars: number,
  raterId: string
) {
  const updated = updateTicket(ticket.id, { rating: stars }) ?? ticket;
  const settings = getSettings(guild.id);
  const type = findTicketType(ticket.type);

  if (settings.feedbackChannelId) {
    const channel =
      guild.channels.cache.get(settings.feedbackChannelId) ??
      (await guild.channels.fetch(settings.feedbackChannelId).catch(() => null));

    if (channel?.isTextBased()) {
      await (channel as TextChannel)
        .send({
          embeds: [
            vyntricEmbed(stars >= 4 ? "success" : stars === 3 ? "warning" : "danger")
              .setTitle(`${starString(stars)}  ${stars}/5 review`)
              .setDescription(
                [
                  `**Ticket:** #${padTicketNumber(ticket.number)} • ${type ? `${type.emoji} ${type.label}` : ticket.type}`,
                  `**Member:** <@${ticket.ownerId}>`,
                  `**Handled by:** ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : "unclaimed"}`,
                  `**Rated by:** <@${raterId}>`,
                ].join("\n")
              ),
          ],
        })
        .catch(() => {});
    }
  }

  await logTicketEvent(guild, `${starString(stars)} Ticket Rated`, [
    `**Ticket:** #${padTicketNumber(ticket.number)}`,
    `**Rating:** ${stars}/5`,
    `**Rated by:** <@${raterId}>`,
    `**Handled by:** ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : "unclaimed"}`,
  ]);

  return updated;
}


