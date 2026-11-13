import {
  ActionRowBuilder,
  ButtonBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { vyntricEmbed } from "./brand";
import { broadcastAnnouncementDm } from "./announce";

/** Edits the progress reply at most this often so we never spam the API. */
const PROGRESS_INTERVAL_MS = 6000;

// Active broadcast safety tracker (prevents overlapping server-wide blasts)
const activeBroadcastGuilds = new Set<string>();
const lastBroadcastTimestamp = new Map<string, number>();

/** Returns true if a DM broadcast is currently in-flight for this guild. */
export function isBroadcastActive(guildId: string): boolean {
  return activeBroadcastGuilds.has(guildId);
}

/** Returns remaining cooldown in seconds (default 30s), or 0 if free. */
export function getBroadcastCooldownRemaining(guildId: string, cooldownSec = 30): number {
  const last = lastBroadcastTimestamp.get(guildId);
  if (!last) return 0;
  const elapsed = Math.floor((Date.now() - last) / 1000);
  if (elapsed < cooldownSec) {
    return cooldownSec - elapsed;
  }
  return 0;
}

/**
 * Sends one embed to every target member's DM while streaming progress back into
 * the (ephemeral) interaction reply, then reports the final tally.
 */
export async function runDmBroadcast(
  interaction: ChatInputCommandInteraction,
  dmEmbed: EmbedBuilder,
  arg3?: ActionRowBuilder<ButtonBuilder>[] | string | null,
  arg4?: string | null,
  arg5?: string
) {
  const guild = interaction.guild;
  if (!guild) return;

  activeBroadcastGuilds.add(guild.id);

  let dmComponents: ActionRowBuilder<ButtonBuilder>[] | undefined;
  let roleFilterId: string | null = null;
  let startMessage = "";

  // If 5th parameter is provided or arg3 is an array, treat as (interaction, embed, components, roleId, startMsg)
  if (Array.isArray(arg3) || arg5 !== undefined) {
    dmComponents = Array.isArray(arg3) && arg3.length > 0 ? arg3 : undefined;
    roleFilterId = arg4 ?? null;
    startMessage = arg5 ?? "";
  } else {
    // Legacy 4-arg signature: (interaction, embed, roleId, startMsg)
    dmComponents = undefined;
    roleFilterId = (arg3 as string | null) ?? null;
    startMessage = arg4 ?? "";
  }

  let lastEdit = Date.now();
  let done = 0;
  let total = 0;

  try {
    const result = await broadcastAnnouncementDm({
      guild,
      embed: dmEmbed,
      components: dmComponents,
      roleFilterId,
      onProgress: async (progressDone, progressTotal) => {
        done = progressDone;
        total = progressTotal;
        if (Date.now() - lastEdit < PROGRESS_INTERVAL_MS) return;
        lastEdit = Date.now();

        await interaction
          .editReply({
            embeds: [
              vyntricEmbed("accent")
                .setTitle("📨 DM alert in progress…")
                .setDescription(
                  [
                    startMessage,
                    "",
                    `**Delivered:** ${done}/${total}`,
                    "-# The announcement is already live in the channel.",
                  ].join("\n")
                ),
            ],
          })
          .catch(() => {});
      },
    });

    await interaction
      .editReply({
        embeds: [
          vyntricEmbed(result.failed > 0 ? "warning" : "success")
            .setTitle("✅ Announcement complete")
            .setDescription(
              [
                startMessage,
                "",
                `**DMs delivered:** ${result.sent}`,
                `**DM failed (closed DMs):** ${result.failed}`,
                `**Skipped:** ${result.skipped} (bots / other roles)`,
                "",
                "-# Members with closed DMs still see the announcement in the channel.",
              ].join("\n")
            ),
        ],
      })
      .catch(() => {});
  } finally {
    activeBroadcastGuilds.delete(guild.id);
    lastBroadcastTimestamp.set(guild.id, Date.now());
  }
}
