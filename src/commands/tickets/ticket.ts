import {
  ChatInputCommandInteraction,
  GuildMember,
  MessageFlags,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { Command } from "../../structures/Command";
import { section, vyntricEmbed } from "../../lib/brand";
import { PRIORITY_META } from "../../lib/panel";
import { buildTranscript } from "../../lib/transcript";
import { closeTicket, reopenTicket, refreshTicketHeader, openTicket } from "../../lib/tickets";
import { findTicketType, TICKET_TYPES } from "../../config/tickets";
import {
  TicketPriority,
  TicketRecord,
  findTicketByChannel,
  findOpenTicketOfType,
  listTickets,
  updateTicket,
} from "../../lib/store";
import { isTicketStaff, padTicketNumber, slugify } from "../../lib/permissions";

const PRIORITIES = Object.keys(PRIORITY_META) as TicketPriority[];

/** Resolves the Vyntric ticket bound to the current channel. */
async function resolveTicket(interaction: ChatInputCommandInteraction) {
  const ticket = findTicketByChannel(interaction.channelId);
  if (!ticket) {
    await interaction.reply({
      content: "This channel is not a Vyntric ticket.",
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }
  return ticket;
}

/** Re-renders the pinned header after a change. */
async function syncHeader(interaction: ChatInputCommandInteraction, ticket: TicketRecord) {
  if (!(interaction.channel instanceof TextChannel) || !interaction.guild) return;
  const owner = await interaction.guild.members.fetch(ticket.ownerId).catch(() => null);
  await refreshTicketHeader(interaction.channel, ticket, owner?.user.tag ?? ticket.ownerId);
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Manage the current Vyntric ticket")
    .addSubcommand((sub) =>
      sub
        .setName("open")
        .setDescription("Open a new support ticket (Ticket Tool style)")
        .addStringOption((option) =>
          option
            .setName("subject")
            .setDescription("What do you need help with?")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a new support ticket")
        .addStringOption((option) =>
          option
            .setName("subject")
            .setDescription("What do you need help with?")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) => sub.setName("info").setDescription("Show information about this ticket"))
    .addSubcommand((sub) => sub.setName("transcript").setDescription("Download the ticket transcript"))
    .addSubcommand((sub) =>
      sub
        .setName("close")
        .setDescription("Close this ticket and generate the transcript")
        .addStringOption((option) =>
          option.setName("reason").setDescription("Why is this ticket being closed?").setRequired(false)
        )
    )
    .addSubcommand((sub) => sub.setName("claim").setDescription("Claim this ticket"))
    .addSubcommand((sub) => sub.setName("unclaim").setDescription("Release this ticket back to the queue"))
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a member to this ticket")
        .addUserOption((option) => option.setName("user").setDescription("Member").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a member from this ticket")
        .addUserOption((option) => option.setName("user").setDescription("Member").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("rename")
        .setDescription("Rename this ticket channel")
        .addStringOption((option) => option.setName("name").setDescription("New channel name").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("priority")
        .setDescription("Set the ticket priority")
        .addStringOption((option) =>
          option
            .setName("level")
            .setDescription("Priority level")
            .setRequired(true)
            .addChoices(...PRIORITIES.map((level) => ({ name: PRIORITY_META[level].label, value: level })))
        )
    )
    .addSubcommand((sub) => sub.setName("reopen").setDescription("Reopen a closed ticket"))
    .addSubcommand((sub) => sub.setName("list").setDescription("List open Vyntric tickets in this server")),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    const sub = interaction.options.getSubcommand();

    if (sub === "open" || sub === "create") {
      if (!interaction.guild) return;
      const type = findTicketType("general_support") || TICKET_TYPES[0];
      const existing = findOpenTicketOfType(interaction.guild.id, member.id, type.id);
      if (existing) {
        await interaction.reply({
          content: `You already have an open ticket: <#${existing.channelId}>`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const subject = interaction.options.getString("subject") || "General Support";
      const { channel } = await openTicket({
        guild: interaction.guild,
        member,
        type,
        answers: {
          subject,
          details: subject,
        },
      });

      await interaction.editReply({
        content: `✅ Your ticket has been opened: <#${channel.id}>`,
      });
      return;
    }

    if (sub === "open" || sub === "create") {
      if (!interaction.guild) return;
      const type = findTicketType("general_support") || TICKET_TYPES[0];
      const existing = findOpenTicketOfType(interaction.guild.id, member.id, type.id);
      if (existing) {
        await interaction.reply({
          content: `You already have an open ticket: <#${existing.channelId}>`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const subject = interaction.options.getString("subject") || "General Support";
      const { channel } = await openTicket({
        guild: interaction.guild,
        member,
        type,
        answers: {
          subject,
          details: subject,
        },
      });

      await interaction.editReply({
        content: `✅ Your ticket has been opened: <#${channel.id}>`,
      });
      return;
    }

    // Server-wide listing does not need a ticket context.
    if (sub === "list") {
      if (!isTicketStaff(member)) {
        await interaction.reply({ content: "Vyntric staff only.", flags: MessageFlags.Ephemeral });
        return;
      }
      const open = listTickets(interaction.guildId!, "open");
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [
          vyntricEmbed("accent")
            .setTitle(`📋 Open Tickets • ${open.length}`)
            .setDescription(
              open.length
                ? open
                    .slice(0, 25)
                    .map(
                      (item) =>
                        `**#${padTicketNumber(item.number)}** • <#${item.channelId}> • <@${item.ownerId}> • ${
                          item.claimedBy ? `claimed by <@${item.claimedBy}>` : "unclaimed"
                        }`
                    )
                    .join("\n")
                : "No open tickets right now — the queue is empty ✨"
            ),
        ],
      });
      return;
    }

    const ticket = await resolveTicket(interaction);
    if (!ticket) return;
    const staff = isTicketStaff(member);

    if (sub === "info") {
      const priority = PRIORITY_META[ticket.priority];
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [
          vyntricEmbed("accent")
            .setTitle(`🎫 Ticket #${padTicketNumber(ticket.number)}`)
            .setDescription(
              [
                section("Overview"),
                `**Type:** ${ticket.type}`,
                `**Member:** <@${ticket.ownerId}>`,
                `**Status:** ${ticket.status === "open" ? "🟢 Open" : "🔒 Closed"}`,
                `**Priority:** ${priority.emoji} ${priority.label}`,
                `**Claimed by:** ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : "nobody yet"}`,
                `**Opened:** <t:${Math.floor(ticket.createdAt / 1000)}:R>`,
                ticket.closedAt ? `**Closed:** <t:${Math.floor(ticket.closedAt / 1000)}:R>` : "",
                ticket.closeReason ? `**Close reason:** ${ticket.closeReason}` : "",
                ticket.rating ? `**Rating:** ${ticket.rating}/5` : "",
              ]
                .filter(Boolean)
                .join("\n")
            ),
        ],
      });
      return;
    }

    if (sub === "transcript") {
      if (!staff && interaction.user.id !== ticket.ownerId) {
        await interaction.reply({
          content: "Only the ticket owner or Vyntric staff can download the transcript.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (!(interaction.channel instanceof TextChannel)) return;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const transcript = await buildTranscript(interaction.channel, ticket);
      await interaction.editReply({
        embeds: [
          vyntricEmbed("accent")
            .setTitle(`📄 Transcript • Ticket #${padTicketNumber(ticket.number)}`)
            .setDescription(
              [
                `**Messages captured:** \`${transcript.messageCount}\``,
                `**Participants:** \`${transcript.participants.length}\``,
                `**Saved on disk:** \`${transcript.savedPath}\``,
              ].join("\n")
            ),
        ],
        files: [transcript.html, transcript.txt],
      });
      return;
    }

    if (sub === "close") {
      if (!staff && interaction.user.id !== ticket.ownerId) {
        await interaction.reply({
          content: "Only the ticket owner or Vyntric staff can close this ticket.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (ticket.status !== "open") {
        await interaction.reply({
          content: "This ticket is already closed.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (!(interaction.channel instanceof TextChannel)) return;

      await interaction.deferReply();
      const reason = interaction.options.getString("reason") ?? "Closed with /ticket close";
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
            .setDescription("Transcript saved and posted to the log channel."),
        ],
      });
      return;
    }

    if (!staff) {
      await interaction.reply({ content: "Vyntric staff only.", flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === "claim" || sub === "unclaim") {
      if (ticket.status !== "open") {
        await interaction.reply({
          content: "Reopen the ticket before claiming it.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const claimed = sub === "claim" ? interaction.user.id : null;
      if (sub === "unclaim" && ticket.claimedBy !== interaction.user.id) {
        await interaction.reply({
          content: "You are not the current handler of this ticket.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const updated = updateTicket(ticket.id, { claimedBy: claimed }) ?? ticket;
      await syncHeader(interaction, updated);

      await interaction.reply({
        embeds: [
          vyntricEmbed(claimed ? "success" : "neutral")
            .setTitle(claimed ? "🖐️ Ticket Claimed" : "↩️ Ticket Released")
            .setDescription(
              claimed
                ? `${member} is now handling <@${ticket.ownerId}>.`
                : "This ticket is back in the queue for any staff member."
            ),
        ],
      });
      return;
    }

    if (sub === "add" || sub === "remove") {
      if (!(interaction.channel instanceof TextChannel)) return;

      const adding = sub === "add";
      const user = interaction.options.getUser("user", true);

      await interaction.channel.permissionOverwrites.edit(user.id, {
        ViewChannel: adding,
        SendMessages: adding,
        ReadMessageHistory: adding,
        AttachFiles: adding,
        AddReactions: adding,
      });

      await interaction.reply({
        embeds: [
          vyntricEmbed(adding ? "success" : "warning")
            .setTitle(adding ? "➕ Member Added" : "➖ Member Removed")
            .setDescription(
              `${user} ${adding ? "can now see" : "no longer has access to"} this ticket.`
            ),
        ],
      });
      return;
    }

    if (sub === "rename") {
      if (!(interaction.channel instanceof TextChannel)) return;

      const name = slugify(interaction.options.getString("name", true));
      await interaction.channel.setName(name);

      await interaction.reply({
        embeds: [
          vyntricEmbed("accent")
            .setTitle("✏️ Ticket Renamed")
            .setDescription(`This ticket channel is now **${name}**.`),
        ],
      });
      return;
    }

    if (sub === "priority") {
      const level = interaction.options.getString("level", true) as TicketPriority;
      const updated = updateTicket(ticket.id, { priority: level }) ?? ticket;
      await syncHeader(interaction, updated);

      const meta = PRIORITY_META[level];
      await interaction.reply({
        embeds: [
          vyntricEmbed(meta.tone)
            .setTitle("⚙️ Priority Updated")
            .setDescription(
              `Ticket #${padTicketNumber(ticket.number)} is now **${meta.emoji} ${meta.label}**.`
            ),
        ],
      });
      return;
    }

    if (sub === "reopen") {
      if (ticket.status === "open") {
        await interaction.reply({
          content: "This ticket is already open.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (!(interaction.channel instanceof TextChannel)) return;

      await interaction.deferReply();
      const reopened = await reopenTicket({
        channel: interaction.channel,
        ticket,
        actor: member,
      });

      await interaction.editReply({
        embeds: [
          vyntricEmbed("success")
            .setTitle(`🔓 Ticket #${padTicketNumber(reopened.number)} reopened`)
            .setDescription(`<@${reopened.ownerId}> can talk in this channel again.`),
        ],
      });
      return;
    }
  },
};

export default command;
