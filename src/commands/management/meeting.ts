import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "../../structures/Command";
import { VyntricClient } from "../../structures/VyntricClient";
import { canManageStaff, isTicketStaff } from "../../lib/permissions";
import { vyntricEmbed, section } from "../../lib/brand";
import { scheduleMeeting, listMeetings } from "../../lib/store";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("meeting")
    .setDescription("Schedule and manage Vyntric team sync meetings")
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .addSubcommand((sub) =>
      sub
        .setName("schedule")
        .setDescription("Schedule an upcoming staff/team sync meeting")
        .addStringOption((opt) =>
          opt
            .setName("title")
            .setDescription("Meeting title / purpose")
            .setRequired(true)
            .setMaxLength(100)
        )
        .addStringOption((opt) =>
          opt
            .setName("time")
            .setDescription("Date & time (e.g. 'Friday 9:00 PM GMT+6')")
            .setRequired(true)
            .setMaxLength(100)
        )
        .addStringOption((opt) =>
          opt
            .setName("agenda")
            .setDescription("Key topics to discuss")
            .setRequired(false)
            .setMaxLength(400)
        )
        .addChannelOption((opt) =>
          opt
            .setName("voice_channel")
            .setDescription("Voice channel for the meeting")
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildVoice)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("View scheduled meetings")
    ),

  async execute(interaction: ChatInputCommandInteraction, _client: VyntricClient) {
    if (!interaction.guild || !interaction.member) return;
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member || !isTicketStaff(member)) {
      await interaction.reply({
        content: "🛡️ Only Vyntric staff members can access the meeting scheduler.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "schedule") {
      if (!canManageStaff(member)) {
        await interaction.reply({
          content: "🛡️ Only Lead Staff / Administrators can schedule official team meetings.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const title = interaction.options.getString("title", true);
      const time = interaction.options.getString("time", true);
      const agenda = interaction.options.getString("agenda") || "Weekly project updates, server performance, and Q&A.";
      const vc = interaction.options.getChannel("voice_channel");

      const meeting = scheduleMeeting({
        guildId: interaction.guild.id,
        title,
        time,
        agenda,
        channelId: vc ? vc.id : null,
        organizerId: interaction.user.id,
        organizerTag: interaction.user.tag,
      });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`meeting:rsvp:${meeting.id}`)
          .setLabel("🙋 I'm Attending (RSVP)")
          .setStyle(ButtonStyle.Success)
      );

      const embed = vyntricEmbed("accent")
        .setTitle(`🎙️ Vyntric Team Sync: ${meeting.title}`)
        .setDescription(
          `${section("Meeting Details")}\n` +
            `• **Time:** 🗓️ **${meeting.time}**\n` +
            `• **Location:** ${meeting.channelId ? `<#${meeting.channelId}>` : "_General Staff VC_"}\n` +
            `• **Organizer:** <@${meeting.organizerId}>\n\n` +
            `${section("Agenda")}\n` +
            `${meeting.agenda}\n\n` +
            `👥 **Confirmed Attendees (0):**\n_Click the button below to confirm your attendance!_`
        );

      await interaction.reply({ embeds: [embed], components: [row] });
      return;
    }

    if (sub === "list") {
      const meetings = listMeetings(interaction.guild.id);
      if (meetings.length === 0) {
        await interaction.reply({
          content: "🗓️ No meetings currently scheduled.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const lines = meetings.slice(0, 5).map((m) => {
        const attendeeCount = m.attendees.length;
        return `\`${m.id}\` **${m.title}**\n↳ Time: **${m.time}** | Location: ${m.channelId ? `<#${m.channelId}>` : "VC"} | RSVPs: ${attendeeCount}`;
      });

      const embed = vyntricEmbed("primary")
        .setTitle("🗓️ Scheduled Vyntric Team Meetings")
        .setDescription(`${section("Upcoming")}\n${lines.join("\n\n")}`);

      await interaction.reply({ embeds: [embed] });
      return;
    }
  },
};

export default command;
