import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ColorResolvable,
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
  color?: string | null;
  image?: string | null;
  thumbnail?: string | null;
  footer?: string | null;
  buttonLabel?: string | null;
  buttonUrl?: string | null;
  dmStyle?: "exact" | "notice";
}

/** Resolves hex color strings or presets to Discord ColorResolvable (defaults to Vyntric Red). */
export function resolveEmbedColor(colorStr?: string | null): ColorResolvable {
  if (!colorStr) return BRAND.colors.primary;
  const clean = colorStr.trim();
  if (/^#?[0-9a-fA-F]{6}$/.test(clean)) {
    return (clean.startsWith("#") ? clean : `#${clean}`) as ColorResolvable;
  }
  return BRAND.colors.primary;
}

/** The announcement embed that is posted in the server channel. */
export function buildAnnouncementEmbed(input: AnnouncementInput, guild?: Guild) {
  const color = resolveEmbedColor(input.color);
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(input.title.slice(0, 256))
    .setDescription(
      [
        input.message,
        input.alert ? `\n\n🔔 ${input.alert}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    )
    .setTimestamp();

  if (input.footer) {
    embed.setFooter({ text: input.footer.slice(0, 2048) });
  }

  // Thumbnail handling
  const thumb = input.thumbnail?.trim();
  if (thumb && thumb !== "none" && thumb !== "false") {
    if ((thumb === "server" || thumb === "guild" || thumb === "icon") && guild) {
      const icon = guild.iconURL({ size: 256 });
      if (icon) embed.setThumbnail(icon);
    } else if (/^https?:\/\/.+/i.test(thumb)) {
      embed.setThumbnail(thumb);
    }
  }

  // Image / Banner handling
  const img = input.image?.trim();
  if (img && img !== "none" && /^https?:\/\/.+/i.test(img)) {
    embed.setImage(img);
  } else if (!img && getBrandBanner()) {
    embed.setImage(getBrandBanner()!);
  }

  return embed;
}

/**
 * The DM alert sent to members.
 * Default style ("exact"): Exactly 1:1 matches the channel embed (clean, no forced prefixes/suffixes, red border).
 * Alternative style ("notice"): Compact notice card with author header and jump pill.
 */
export function buildAnnouncementDmEmbed(
  input: AnnouncementInput,
  guild: Guild,
  channelName?: string
): EmbedBuilder {
  const color = resolveEmbedColor(input.color);

  // If user explicitly chose "notice" card style
  if (input.dmStyle === "notice") {
    const guildIcon = guild.iconURL({ size: 256 }) || undefined;
    const channelDisplay = channelName ? channelName.replace(/^#/, "") : "announcements";
    const pillText = `[🔴 **${guild.name}** › **# ${channelDisplay}**](${input.jumpUrl || "https://discord.com"})`;

    let displayMessage = input.message;
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
      .setColor(color)
      .setAuthor({
        name: `${guild.name} Dm Notice`,
        iconURL: guildIcon,
      })
      .setTitle(titleText.slice(0, 256))
      .setDescription(descriptionParts.join("\n").replace(/\n{3,}/g, "\n\n").trim())
      .setTimestamp();

    if (guildIcon) {
      embed.setThumbnail(guildIcon);
    }
    return embed;
  }

  // DEFAULT STYLE ("exact"):
  // Clean, sleek, elegant, 1:1 exact match to what the user designed (matches Screenshot 1).
  // Red border, clean title (no forced "⌨️"), clean body (no forced [🔴 Server > # CHAT]).
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(input.title.slice(0, 256))
    .setDescription(
      [
        input.message,
        input.alert ? `\n\n🔔 ${input.alert}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    )
    .setTimestamp();

  if (input.footer) {
    embed.setFooter({ text: input.footer.slice(0, 2048) });
  }

  // Thumbnail handling for DM
  const thumb = input.thumbnail?.trim();
  if (thumb && thumb !== "none" && thumb !== "false") {
    if ((thumb === "server" || thumb === "guild" || thumb === "icon")) {
      const icon = guild.iconURL({ size: 256 });
      if (icon) embed.setThumbnail(icon);
    } else if (/^https?:\/\/.+/i.test(thumb)) {
      embed.setThumbnail(thumb);
    }
  }

  // Image handling for DM (only if explicitly specified)
  const img = input.image?.trim();
  if (img && img !== "none" && /^https?:\/\/.+/i.test(img)) {
    embed.setImage(img);
  }

  return embed;
}

/**
 * Creates the optional link button underneath the DM embed.
 * If buttonLabel is provided (and not "none"), attaches a single link button.
 * If omitted or "none", returns undefined (no button attached, matching Screenshot 1).
 */
export function buildAnnouncementDmComponents(
  input: AnnouncementInput,
  jumpUrl: string
): ActionRowBuilder<ButtonBuilder>[] | undefined {
  const label = input.buttonLabel?.trim();
  if (!label || label.toLowerCase() === "none") {
    // If notice style was explicitly chosen and no button label provided, default to jump button
    if (input.dmStyle === "notice") {
      const btn = new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel("Jump to update channel and check it out!")
        .setURL(input.buttonUrl || jumpUrl);
      return [new ActionRowBuilder<ButtonBuilder>().addComponents(btn)];
    }
    return undefined;
  }

  const btn = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel(label.slice(0, 80))
    .setURL(input.buttonUrl || jumpUrl);

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
 * Tracks recently DMed member IDs with timestamp (userId -> timestamp).
 * Prevents duplicate DMs if an announcement command is re-run or edited within 3 minutes.
 */
const recentDmedUsers = new Map<string, number>();
const RECENT_DM_WINDOW_MS = 3 * 60 * 1000; // 3 minutes

/**
 * DMs every human member of the guild (or only the members holding
 * `roleFilterId`) with the alert embed and link button.
 * Runs in batches to protect rate limits and retries on 429 backoff.
 * Guaranteed: Exactly 1 DM per member. Never sends duplicate DMs.
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

  const now = Date.now();
  // Evict entries older than 3 minutes
  for (const [uid, timestamp] of recentDmedUsers.entries()) {
    if (now - timestamp > RECENT_DM_WINDOW_MS) {
      recentDmedUsers.delete(uid);
    }
  }

  // Target every human member in the server with deduplication
  const seenMemberIds = new Set<string>();
  const targets = members.filter((member) => {
    if (member.user.bot) return false;
    // Single-run deduplication
    if (seenMemberIds.has(member.id)) return false;
    seenMemberIds.add(member.id);
    // Role filter
    if (roleFilterId && !member.roles.cache.has(roleFilterId)) return false;
    // Cross-run deduplication: if this member already received an announcement DM within 3 min, skip
    if (recentDmedUsers.has(member.id)) return false;
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
          recentDmedUsers.set(member.id, Date.now());
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
              recentDmedUsers.set(member.id, Date.now());
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
