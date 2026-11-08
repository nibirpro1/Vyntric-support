import { Interaction, MessageFlags } from "discord.js";
import { VyntricClient } from "../structures/VyntricClient";
import { handleTicketComponent } from "../interactions/ticketInteractions";
import { handleRoleButton } from "../interactions/roleInteractions";
import { handleVerificationButton } from "../interactions/verificationInteractions";
import { musicManager } from "../music/MusicManager";
import { IDS } from "../lib/customIds";
import { BRAND } from "../lib/brand";
import { toggleRsvpMeeting } from "../lib/store";
import { handleGiveawayButton } from "../lib/giveawayManager";

async function safeError(interaction: Interaction) {
  if (!interaction.isRepliable()) return;
  const content = `Something went wrong inside ${BRAND.name}. Please try again.`;

  try {
    if (interaction.deferred) {
      await interaction.editReply({ content });
    } else if (interaction.replied) {
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }
  } catch {
    /* interaction expired or already acknowledged */
  }
}

export default {
  name: "interactionCreate",
  once: false,
  async execute(interaction: Interaction, client: VyntricClient) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        console.warn(`[command:${interaction.commandName}] not loaded — this build is stale?`);
        try {
          await interaction.reply({
            content:
              `\`/${interaction.commandName}\` is not loaded in this running process. ` +
              "Restart the bot so it picks up the newest build, then try again.",
            flags: MessageFlags.Ephemeral,
          });
        } catch {
          /* interaction expired */
        }
        return;
      }

      try {
        await command.execute(interaction, client);
      } catch (err) {
        console.error(`[command:${interaction.commandName}]`, err);
        await safeError(interaction);
      }
      return;
    }

    try {
      if (
        interaction.isButton() &&
        (interaction.customId.startsWith("gw_enter:") || interaction.customId.startsWith("gw_entries:"))
      ) {
        await handleGiveawayButton(interaction, client);
        return;
      }

      if (interaction.isButton() && interaction.customId === IDS.verifyButton) {
        await handleVerificationButton(interaction, client);
        return;
      }

      if (interaction.isButton() && interaction.customId.startsWith("meeting:rsvp:")) {
        const meetingId = interaction.customId.replace("meeting:rsvp:", "");
        const res = toggleRsvpMeeting(meetingId, interaction.user.id);
        if (!res) {
          await interaction.reply({
            content: "⚠️ Meeting record not found.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const attendeeMentions = res.meeting.attendees.map((id) => `<@${id}>`).join(", ") || "_None yet_";
        const msg = res.attending
          ? `✅ You have confirmed attendance for **${res.meeting.title}**!\nTotal Attendees (${res.meeting.attendees.length}): ${attendeeMentions}`
          : `❌ You removed your RSVP for **${res.meeting.title}**.\nTotal Attendees (${res.meeting.attendees.length}): ${attendeeMentions}`;

        await interaction.reply({
          content: msg,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (interaction.isButton() && interaction.customId.startsWith("music:")) {
        await musicManager.handleButton(interaction);
        return;
      }

      if (interaction.isButton() && interaction.customId.startsWith("rr:")) {
        const roleId = interaction.customId.replace("rr:", "");
        const member =
          interaction.guild?.members.cache.get(interaction.user.id) ||
          (await interaction.guild?.members.fetch(interaction.user.id).catch(() => null));
        const role = interaction.guild?.roles.cache.get(roleId);

        if (!member || !role) {
          await interaction.reply({
            content: "⚠️ Role or member not found.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        try {
          if (member.roles.cache.has(roleId)) {
            await member.roles.remove(role, "Reaction role toggle");
            await interaction.reply({
              content: `❌ Removed role **<@&${roleId}>**.`,
              flags: MessageFlags.Ephemeral,
            });
          } else {
            await member.roles.add(role, "Reaction role toggle");
            await interaction.reply({
              content: `✅ Added role **<@&${roleId}>**!`,
              flags: MessageFlags.Ephemeral,
            });
          }
        } catch (err: any) {
          await interaction.reply({
            content: `⚠️ Failed to update role. Please ensure the bot's role is positioned higher than **${role.name}**.`,
            flags: MessageFlags.Ephemeral,
          });
        }
        return;
      }

      if (interaction.isButton() && interaction.customId.startsWith("vs:")) {
        await handleRoleButton(interaction, client);
        return;
      }

      if (
        interaction.isButton() ||
        interaction.isStringSelectMenu() ||
        interaction.isModalSubmit()
      ) {
        await handleTicketComponent(interaction, client);
      }
    } catch (err) {
      console.error("[interaction]", err);
      await safeError(interaction);
    }
  },
};
