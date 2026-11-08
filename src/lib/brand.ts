import { EmbedBuilder } from "discord.js";

/**
 * Vyntric Support brand system.
 * The emblem doubles as the bot avatar, so the icon used in every embed can be
 * refreshed simply by changing the avatar in Discord (or BRAND_ICON_URL).
 */
export const BRAND = {
  name: "Plugsy",
  shortName: "Plugsy",
  footer: "Plugsy • All-in-One Discord Bot",
  divider: "▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬",
  colors: {
    primary: 0xb1121f,
    accent: 0xe23a4e,
    gold: 0xf2c14e,
    rose: 0xd1435a,
    success: 0x2fbf71,
    warning: 0xf0a32e,
    danger: 0xc81e2e,
    neutral: 0x1b1013,
  },
} as const;

export type BrandTone = keyof typeof BRAND.colors;

let brandIcon: string | undefined;
let brandBanner: string | undefined;

/** Called on ready so every embed uses the live bot avatar as its icon. */
export function setBrandAssets(options: { icon?: string; banner?: string }) {
  brandIcon = options.icon || process.env.BRAND_ICON_URL || undefined;
  brandBanner = options.banner || process.env.BRAND_BANNER_URL || undefined;
}

export function getBrandIcon() {
  return brandIcon;
}

export function getBrandBanner() {
  return brandBanner;
}

/** The one embed factory used all over Vyntric Support. */
export function vyntricEmbed(tone: BrandTone = "primary") {
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors[tone])
    .setAuthor({ name: BRAND.name, iconURL: brandIcon })
    .setFooter({ text: BRAND.footer, iconURL: brandIcon })
    .setTimestamp();

  if (brandIcon) embed.setThumbnail(brandIcon);
  return embed;
}

/** Small pill used as a section title inside embed descriptions. */
export function section(title: string) {
  return `**${title}**\n${BRAND.divider}`;
}
