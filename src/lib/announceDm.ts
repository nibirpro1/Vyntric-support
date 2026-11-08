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

/**
 * Sends one embed to every target member's DM while streaming progress back into
 * the (ephemeral) interaction reply, then reports the final tally.
 */
export async function runDmBroadcast(
  interaction: ChatInputCommandInteraction,
  dmEmbed: EmbedBuilder,
  arg3: ActionRowBuilder<ButtonBuilder>[] | string | null | undefined,
  arg4?: string | null,
  arg5?: string
) {
  const guild = interaction.guild;
  if (!guild) return;

  let dmComponents: ActionRowBuilder<ButtonBuilder>[] | undefined;
  let roleFilterId: string | null = null;
  let startMessage = "";

  if (Array.isArray(arg3)) {
    dmComponents = arg3;
    roleFilterId = arg4 ?? null;
    startMessage = arg5 ?? "";
  } else {
    dmComponents = undefined;
    roleFilterId = (arg3 as string | null) ?? null;
    startMessage = arg4 ?? "";
  }

  let lastEdit = Date.now();
  let done = 0;
  let total = 0;

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
}
