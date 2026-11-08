import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  TextChannel,
} from "discord.js";
import { VyntricClient } from "../structures/VyntricClient";
import { BRAND } from "./brand";
import {
  getActiveGiveaways,
  getGiveaway,
  Giveaway,
  saveGiveaway,
  toggleGiveawayEntry,
} from "./giveawayStore";

/**
 * Parses user-friendly duration strings like:
 * "10s", "5m", "2h", "1d", "1w", "1h 30m"
 */
export function parseDuration(input: string): number | null {
  const clean = input.trim().toLowerCase();
  const regex = /(?:(\d+)\s*w)?\s*(?:(\d+)\s*d)?\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?/;
  const match = clean.match(regex);
  if (!match || match[0] === "") return null;

  const weeks = parseInt(match[1] || "0", 10);
  const days = parseInt(match[2] || "0", 10);
  const hours = parseInt(match[3] || "0", 10);
  const minutes = parseInt(match[4] || "0", 10);
  const seconds = parseInt(match[5] || "0", 10);

  const totalMs =
    weeks * 7 * 24 * 60 * 60 * 1000 +
    days * 24 * 60 * 60 * 1000 +
    hours * 60 * 60 * 1000 +
    minutes * 60 * 1000 +
    seconds * 1000;

  return totalMs > 0 ? totalMs : null;
}

export function buildGiveawayEmbed(g: Giveaway): EmbedBuilder {
  const endTimestampSec = Math.floor(g.endTime / 1000);
  const endDate = new Date(g.endTime);
  const day = String(endDate.getDate()).padStart(2, "0");
  const month = String(endDate.getMonth() + 1).padStart(2, "0");
  const year = endDate.getFullYear();
  const dateFormatted = `${day}/${month}/${year}`;

  const embed = new EmbedBuilder()
    .setColor(0x00d2d3) // Teal/Cyan matching the user screenshot
    .setAuthor({ name: "🎁 New Giveaway 🎁" })
    .setTitle(`🎁 ${g.prize} 🎁`)
    .setDescription(
      [
        `🔹 **Winners:** \`${g.winnersCount}\``,
        `🔹 **Ends:** <t:${endTimestampSec}:R> ( <t:${endTimestampSec}:f> )`,
        `🔹 **Hosted by:** <@${g.hostId}>`,
        g.requiredRoleId ? `🔹 **Required Role:** <@&${g.requiredRoleId}>` : null,
        "",
        `🔹 React with 🎉 or click below to participate!`,
        `🔹 **Entries:** \`${g.entries.length}\``,
      ]
        .filter(Boolean)
        .join("\n")
    )
    .setFooter({ text: `Ends at • ${dateFormatted}` });

  return embed;
}

export function buildGiveawayComponents(g: Giveaway): ActionRowBuilder<ButtonBuilder>[] {
  const enterBtn = new ButtonBuilder()
    .setCustomId(`gw_enter:${g.messageId || ""}`)
    .setLabel(`🎉 Enter (${g.entries.length})`)
    .setStyle(ButtonStyle.Success);

  const viewBtn = new ButtonBuilder()
    .setCustomId(`gw_entries:${g.messageId || ""}`)
    .setLabel("👥 View Entries")
    .setStyle(ButtonStyle.Secondary);

  return [new ActionRowBuilder<ButtonBuilder>().addComponents(enterBtn, viewBtn)];
}

export function buildEndedGiveawayEmbed(g: Giveaway, winnersText: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setAuthor({ name: "🎉 Giveaway Ended 🎉" })
    .setTitle(`🎁 ${g.prize} 🎁`)
    .setDescription(
      [
        `🔹 **Hosted by:** <@${g.hostId}>`,
        `🏆 **Winner(s):** ${winnersText}`,
        `🔹 **Total Entries:** \`${g.entries.length}\``,
        `⏰ **Ended:** <t:${Math.floor(g.endTime / 1000)}:R>`,
      ].join("\n")
    )
    .setFooter({ text: `Giveaway Ended` })
    .setTimestamp(Date.now());

  return embed;
}

export function buildEndedGiveawayComponents(g: Giveaway): ActionRowBuilder<ButtonBuilder>[] {
  const enterBtn = new ButtonBuilder()
    .setCustomId(`gw_enter_ended:${g.messageId || ""}`)
    .setLabel(`Ended (${g.entries.length} entries)`)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);

  return [new ActionRowBuilder<ButtonBuilder>().addComponents(enterBtn)];
}

// Active timeouts tracker: messageId -> Timeout
const activeTimeouts = new Map<string, NodeJS.Timeout>();

export async function endGiveaway(
  messageId: string,
  client: VyntricClient,
  forcedWinnerId?: string,
  forceRandom: boolean = false
): Promise<{ success: boolean; winners: string[]; message?: string }> {
  // Clear any existing timer
  if (activeTimeouts.has(messageId)) {
    clearTimeout(activeTimeouts.get(messageId)!);
    activeTimeouts.delete(messageId);
  }

  const g = getGiveaway(messageId);
  if (!g) return { success: false, winners: [], message: "Giveaway not found." };
  if (g.ended) return { success: false, winners: g.winnerIds, message: "Giveaway already ended." };

  g.ended = true;

  // ─────────────────────────────────────────────────────────────
  // WINNER SELECTION ALGORITHM
  // Supports both 100% Fair Random Mode AND Secret / Predetermined Winners
  // ─────────────────────────────────────────────────────────────
  const chosenWinners: string[] = [];

  if (!forceRandom) {
    // 1. Manual forced winner (e.g. from /giveaway end or reroll)
    if (forcedWinnerId) {
      if (!chosenWinners.includes(forcedWinnerId)) {
        chosenWinners.push(forcedWinnerId);
        if (!g.entries.includes(forcedWinnerId)) g.entries.push(forcedWinnerId);
      }
    }

    // 2. Secret / Predetermined winners configured by staff
    if (g.secretWinnerIds && g.secretWinnerIds.length > 0) {
      for (const secretId of g.secretWinnerIds) {
        if (chosenWinners.length >= g.winnersCount) break;
        if (!chosenWinners.includes(secretId)) {
          chosenWinners.push(secretId);
          // Ensure they exist in entries so it looks completely authentic
          if (!g.entries.includes(secretId)) {
            g.entries.push(secretId);
          }
        }
      }
    }
  }

  // 3. Fill remaining winner slots randomly from entries (or all slots if random mode)
  const pool = g.entries.filter((id) => !chosenWinners.includes(id));
  while (chosenWinners.length < g.winnersCount && pool.length > 0) {
    const randIdx = Math.floor(Math.random() * pool.length);
    const winner = pool.splice(randIdx, 1)[0];
    chosenWinners.push(winner);
  }

  g.winnerIds = chosenWinners;
  saveGiveaway(g);

  // Update Discord Message & announce
  try {
    const channel = client.channels.cache.get(g.channelId) as TextChannel | undefined;
    if (channel) {
      const msg = await channel.messages.fetch(g.messageId).catch(() => null);
      const winnersText =
        chosenWinners.length > 0
          ? chosenWinners.map((w) => `<@${w}>`).join(", ")
          : "_No valid entries_";

      if (msg) {
        await msg.edit({
          embeds: [buildEndedGiveawayEmbed(g, winnersText)],
          components: buildEndedGiveawayComponents(g),
        }).catch(() => {});
      }

      if (chosenWinners.length > 0) {
        await channel.send({
          content: `🎉 Congratulations ${winnersText}! You won **${g.prize}**!\n-# Hosted by <@${g.hostId}>`,
        }).catch(() => {});
      } else {
        await channel.send({
          content: `⚠️ Giveaway for **${g.prize}** ended, but no valid entries were found.`,
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error("[giveaways:end:error]", err);
  }

  return { success: true, winners: chosenWinners };
}

export async function rerollGiveaway(
  messageId: string,
  client: VyntricClient,
  secretWinnerId?: string
): Promise<{ success: boolean; newWinner?: string; message?: string }> {
  const g = getGiveaway(messageId);
  if (!g) return { success: false, message: "Giveaway not found." };
  if (!g.ended) return { success: false, message: "Giveaway is still running! Use /giveaway end first." };

  let newWinner: string | null = null;

  if (secretWinnerId) {
    newWinner = secretWinnerId;
    if (!g.entries.includes(secretWinnerId)) g.entries.push(secretWinnerId);
  } else {
    // Pick from entrants who didn't already win (or all entrants if all won)
    const pool = g.entries.filter((id) => !g.winnerIds.includes(id));
    const finalPool = pool.length > 0 ? pool : g.entries;
    if (finalPool.length === 0) {
      return { success: false, message: "No entries available to reroll." };
    }
    const randIdx = Math.floor(Math.random() * finalPool.length);
    newWinner = finalPool[randIdx];
  }

  g.winnerIds = [newWinner];
  saveGiveaway(g);

  // Announce reroll in channel
  try {
    const channel = client.channels.cache.get(g.channelId) as TextChannel | undefined;
    if (channel) {
      const msg = await channel.messages.fetch(g.messageId).catch(() => null);
      if (msg) {
        await msg.edit({
          embeds: [buildEndedGiveawayEmbed(g, `<@${newWinner}>`)],
        }).catch(() => {});
      }
      await channel.send({
        content: `🎉 **GIVEAWAY REROLL:** Congratulations <@${newWinner}>! You are the new winner of **${g.prize}**!`,
      }).catch(() => {});
    }
  } catch (err) {
    console.error("[giveaway:reroll:error]", err);
  }

  return { success: true, newWinner };
}

export function scheduleGiveawayTimer(g: Giveaway, client: VyntricClient) {
  if (g.ended) return;

  const now = Date.now();
  const delay = Math.max(0, g.endTime - now);

  if (activeTimeouts.has(g.messageId)) {
    clearTimeout(activeTimeouts.get(g.messageId)!);
  }

  const timeout = setTimeout(() => {
    endGiveaway(g.messageId, client).catch((err) =>
      console.error("[giveaways:timeout:error]", err)
    );
  }, delay);

  activeTimeouts.set(g.messageId, timeout);
}

/**
 * Initializes all active giveaways on bot startup
 */
export function initGiveaways(client: VyntricClient) {
  const active = getActiveGiveaways();
  console.log(`[giveaways] Resuming ${active.length} active giveaway(s)...`);

  for (const g of active) {
    if (g.endTime <= Date.now()) {
      // Ended while bot was offline
      endGiveaway(g.messageId, client).catch(() => {});
    } else {
      scheduleGiveawayTimer(g, client);
    }
  }

  // Periodic heartbeat every 30s to ensure no timers get stuck
  setInterval(() => {
    const checkActive = getActiveGiveaways();
    const now = Date.now();
    for (const g of checkActive) {
      if (g.endTime <= now) {
        endGiveaway(g.messageId, client).catch(() => {});
      }
    }
  }, 30_000);
}

/**
 * Handles button interactions for Enter and View Entries
 */
export async function handleGiveawayButton(
  interaction: ButtonInteraction,
  client: VyntricClient
): Promise<void> {
  const customId = interaction.customId;

  if (customId.startsWith("gw_enter")) {
    const rawId = customId.replace("gw_enter:", "").replace("gw_enter", "").trim();
    const messageId = rawId || interaction.message.id;
    const g = getGiveaway(messageId);

    if (!g) {
      await interaction.reply({
        content: "⚠️ This giveaway record could not be found.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (g.ended) {
      await interaction.reply({
        content: "⌛ This giveaway has already ended!",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Role requirement check
    if (g.requiredRoleId) {
      const member =
        interaction.guild?.members.cache.get(interaction.user.id) ||
        (await interaction.guild?.members.fetch(interaction.user.id).catch(() => null));
      if (!member || !member.roles.cache.has(g.requiredRoleId)) {
        await interaction.reply({
          content: `❌ You must have the <@&${g.requiredRoleId}> role to enter this giveaway!`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    const res = toggleGiveawayEntry(messageId, interaction.user.id);
    if (!res) return;

    // Update the message components with new entry count
    try {
      await interaction.message.edit({
        embeds: [buildGiveawayEmbed(g)],
        components: buildGiveawayComponents(g),
      });
    } catch {
      /* ignore */
    }

    if (res.entered) {
      await interaction.reply({
        content: `🎉 You have **entered** the giveaway for **${g.prize}**! Good luck! (Total Entries: **${g.entries.length}**)`,
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        content: `❌ You have **left** the giveaway for **${g.prize}**. (Total Entries: **${g.entries.length}**)`,
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }

  if (customId.startsWith("gw_entries")) {
    const rawId = customId.replace("gw_entries:", "").replace("gw_entries", "").trim();
    const messageId = rawId || interaction.message.id;
    const g = getGiveaway(messageId);

    if (!g) {
      await interaction.reply({
        content: "⚠️ Giveaway not found.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (g.entries.length === 0) {
      await interaction.reply({
        content: `👥 **Total Entries: 0**\nBe the first to enter!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const preview = g.entries.slice(0, 40).map((id) => `<@${id}>`).join(", ");
    const extra = g.entries.length > 40 ? `\n...and ${g.entries.length - 40} more` : "";

    await interaction.reply({
      content: `👥 **Total Entries: ${g.entries.length}**\n${preview}${extra}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
}
