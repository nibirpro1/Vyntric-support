import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Guild,
  GuildMember,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import { BRAND, getBrandBanner } from "./brand";

export interface AnnouncementInput {
  title: string;
  message: string;
  alert?: string | null;
  actorTag: string;
  pingRoleId?: string | null;
  jumpUrl?: string | null;
}

/** The announcement embed that is posted in the server channel. */
export function buildAnnouncementEmbed(input: AnnouncementInput) {
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setTitle(input.title.slice(0, 250))
    .setDescription(
      [
        input.message,
        input.alert ? `\n🔔 ${input.alert}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    );

  const banner = getBrandBanner();
  if (banner) embed.setImage(banner);
  return embed;
}

/**
 * The DM alert every member receives matching the user's requested screenshot style:
 * - Author: [Server Name] Dm Notice with server icon
 * - Title: ⌨️ [Title]
 * - Thumbnail: Vyntric Server Logo
 * - Description: Announcement text + [🔴 Server Name › # channel-name](jumpUrl)
 */
export function buildAnnouncementDmEmbed(
  input: AnnouncementInput,
  guild: Guild,
  channelName?: string
): EmbedBuilder {
  const guildIcon = guild.iconURL({ size: 256 }) || undefined;
  const channelDisplay = channelName ? channelName.replace(/^#/, "") : "announcements";
  const pillText = `[🔴 **${guild.name}** › **# ${channelDisplay}**](${input.jumpUrl || "https://discord.com"})`;

  let displayMessage = input.message;
  // If the user's message is just a raw Discord message jump link, don't show an ugly naked link
  if (/^https?:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/channels\/\d+\/\d+\/\d+$/i.test(displayMessage.trim())) {
    displayMessage = input.alert ? input.alert : "A new announcement has been published in the server!";
  }

  const descriptionParts = [
    displayMessage ? displayMessage : (input.alert ? input.alert : ""),
    "",
    pillText,
  ].filter((p) => p !== null && p !== undefined && p !== "");

  const titleText = input.title.startsWith("⌨️") || input.title.startsWith("🔔")
    ? input.title
    : `⌨️ ${input.title}`;

  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor({
      name: `${guild.name} Dm Notice`,
      iconURL: guildIcon,
    })
    .setTitle(titleText.slice(0, 250))
    .setDescription(descriptionParts.join("\n").replace(/\n{3,}/g, "\n\n").trim());

  if (guildIcon) {
    embed.setThumbnail(guildIcon);
  }

  return embed;
}

/**
 * Creates the link button underneath the DM embed:
 * "Jump to update channel and check it out!"
 */
export function buildAnnouncementDmComponents(jumpUrl: string): ActionRowBuilder<ButtonBuilder>[] {
  const btn = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel("Jump to update channel and check it out!")
    .setURL(jumpUrl);

  return [new ActionRowBuilder<ButtonBuilder>().addComponents(btn)];
}

export interface BroadcastResult {
  sent: number;
  failed: number;
  skipped: number;
  total: number;
}

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1200;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * DMs every human member of the guild (or only the members holding
 * `roleFilterId`) with the alert embed and link button.
 * Runs in batches to protect rate limits and retries on 429 backoff.
 */
export async function broadcastAnnouncementDm(options: {
  guild: Guild;
  embed: EmbedBuilder;
  components?: ActionRowBuilder<ButtonBuilder>[];
  roleFilterId?: string | null;
  onProgress?: (done: number, total: number) => void;
}): Promise<BroadcastResult> {
  const { guild, embed, components, roleFilterId, onProgress } = options;

  let members: GuildMember[];
  try {
    members = [...(await guild.members.fetch()).values()];
  } catch {
    members = [...guild.members.cache.values()];
  }

  // Target every human member in the server with deduplication
  const seenMemberIds = new Set<string>();
  const targets = members.filter((member) => {
    if (member.user.bot) return false;
    if (seenMemberIds.has(member.id)) return false;
    seenMemberIds.add(member.id);
    if (roleFilterId && !member.roles.cache.has(roleFilterId)) return false;
    return true;
  });

  const result: BroadcastResult = {
    sent: 0,
    failed: 0,
    skipped: members.length - targets.length,
    total: targets.length,
  };

  for (let index = 0; index < targets.length; index += BATCH_SIZE) {
    const batch = targets.slice(index, index + BATCH_SIZE);

    await Promise.all(
      batch.map(async (member) => {
        try {
          await member.send({
            embeds: [embed],
            components: components ? components : [],
          });
          result.sent += 1;
        } catch (err: any) {
          if (err?.status === 429) {
            // Rate limit backoff & retry once
            const retryAfter = err?.retryAfter ? Number(err.retryAfter) * 1000 : 2000;
            await sleep(retryAfter);
            try {
              await member.send({
                embeds: [embed],
                components: components ? components : [],
              });
              result.sent += 1;
              return;
            } catch {
              result.failed += 1;
              return;
            }
          }
          // Closed DMs or cannot message user
          result.failed += 1;
        }
      })
    );

    onProgress?.(Math.min(index + BATCH_SIZE, targets.length), targets.length);
    if (index + BATCH_SIZE < targets.length) await sleep(BATCH_DELAY_MS);
  }

  return result;
}

/** True when the bot may post in this channel (used before announcing). */
export function canPost(channel: TextChannel, member: GuildMember) {
  const perms = channel.permissionsFor(member);
  return Boolean(
    perms?.has([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ])
  );
}

export type PingChoice = "everyone" | "here";

/** Message content for an announcement: `@everyone` / `@here` / role ping. */
export function buildPingContent(options: { ping?: string | null; pingRoleId?: string | null }) {
  const parts: string[] = [];
  if (options.ping === "everyone") parts.push("@everyone");
  if (options.ping === "here") parts.push("@here");
  if (options.pingRoleId) parts.push(`<@&${options.pingRoleId}>`);
  return parts.join(" ");
}

/** allowedMentions payload matching `buildPingContent`. */
export function buildAllowedMentions(options: { ping?: string | null; pingRoleId?: string | null }) {
  if (options.ping === "everyone") return { parse: ["everyone" as const] };
  if (options.ping === "here") return { parse: ["everyone" as const] };
  if (options.pingRoleId) return { roles: [options.pingRoleId] };
  return { parse: [] };
}
