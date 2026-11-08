import { EmbedBuilder } from "discord.js";
import { BRAND } from "./brand";

/**
 * Vyntric UHC event announcement.
 * One command builds the whole tournament-style layout: info, banned items,
 * rules, allowed items, optional prize + extra sections and the server IP.
 */
export interface UhcEventInput {
  title: string;
  border: string;
  version: string;
  time: string;
  team: string;
  ip: string;
  prize?: string | null;
  extra?: string | null;
  /** Optional extra feature sections (Kits, Revive, Stun, Supply Drop...). */
  features?: string | null;
  mace?: string | null;
  cart?: string | null;
  customBanned?: string | null;
  customAllowed?: string | null;
}

export const UHC_DEFAULTS = {
  title: "⚔️ VYNTRIC X ESSENCE UHC EVENT ⚔️",
  border: "500 × 500",
  version: "1.21+",
  team: "Squad",
  ip: "paid22.skilloraclouds.com:20033",
  schedule: "9:00 PM (daily)",
};

/** The full announcement embed posted in the event channel. */
export function buildUhcEmbed(input: UhcEventInput) {
  const bannedList: string[] = [
    "❌ Crystal",
    "❌ Respawn Anchor",
    "❌ Knockback II",
    "❌ Fire Aspect",
    "❌ Thorns",
    "❌ Punch",
  ];

  const allowedList: string[] = [
    "✅ Knockback I",
    "✅ Totem — **only 1 per player**",
  ];

  // Mace handling
  const maceLower = (input.mace ?? "ban").toLowerCase().trim();
  if (maceLower.includes("allow") || maceLower === "yes") {
    allowedList.unshift("✅ Mace — **Allowed**");
  } else {
    bannedList.unshift("❌ Mace — **BANNED**");
  }

  // Cart (TNT Minecart) handling
  const cartLower = (input.cart ?? "max 3").toLowerCase().trim();
  if (cartLower.includes("ban") || cartLower === "no") {
    bannedList.push("❌ TNT Minecart — **BANNED**");
  } else if (cartLower.includes("allow") || cartLower === "yes") {
    allowedList.push("✅ TNT Minecart — **Allowed**");
  } else {
    allowedList.push(`✅ TNT Minecart — **${input.cart || "max 3 per squad"}**`);
  }

  // Append any custom banned items
  if (input.customBanned) {
    const customBans = input.customBanned.split(/[,|\n]/).map(s => s.trim()).filter(Boolean);
    for (const b of customBans) {
      bannedList.push(`❌ ${b}`);
    }
  }

  // Append any custom allowed items
  if (input.customAllowed) {
    const customAllows = input.customAllowed.split(/[,|\n]/).map(s => s.trim()).filter(Boolean);
    for (const a of customAllows) {
      allowedList.push(`✅ ${a}`);
    }
  }

  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.danger)
    .setTitle(input.title.slice(0, 250))
    .setDescription(
      [
        "A **Vyntric x Essence** open world UHC. Read everything below before you queue.",
        "",
        "━━━━━━━━━━━━━━━━━━━━",
        "🔥 **Play fair. Fight hard. Survive.**",
        "🎯 Always try your best and give your all in the game!",
      ].join("\n")
    )
    .addFields(
      {
        name: "📌 Info",
        value: [
          `🌎 Border: **${input.border}**`,
          `🧱 Version: **${input.version}**`,
          `🕘 Time: **${input.time}**`,
          `👥 Team Limit: **${input.team}**`,
        ].join("\n"),
      },
      {
        name: "🚫 Banned Items & Enchants",
        value: bannedList.join("\n"),
      },
      {
        name: "⚠️ Event Rules",
        value: [
          "❌ **No Cross-Team** — do not team with another squad",
          "❌ **No Abuse** — respect every player and staff member",
          "❌ **No Toxicity** — keep the event clean and respectful",
          "❌ **No Hacking** — any form of cheating is prohibited",
          "❌ **No Exploiting** — bugs and glitches are off limits",
          "",
          "🔨 Breaking any rule may result in a **DIRECT BAN**.",
        ].join("\n"),
      },
      {
        name: "✅ Allowed Items & Enchants",
        value: allowedList.join("\n"),
      }
    );

  if (input.prize) {
    embed.addFields({ name: "🏆 Prize Pool", value: input.prize });
  }

  if (input.features) {
    embed.addFields({ name: "🧩 Event Features", value: input.features.slice(0, 1024) });
  }

  if (input.extra) {
    embed.addFields({ name: "📋 Extra Info", value: input.extra.slice(0, 1024) });
  }

  embed.addFields(
    { name: "🌐 Server IP", value: `\`${input.ip}\`` },
    { name: "🕘 Starts", value: `${input.time} — be online 10 minutes early.` }
  );

  return embed;
}

/** Short version DM-ed to every member. */
export function buildUhcDmEmbed(input: UhcEventInput, guildName: string, jumpUrl?: string | null) {
  return new EmbedBuilder()
    .setColor(BRAND.colors.gold)
    .setTitle(input.title.slice(0, 250))
    .setDescription(
      [
        "🔔 **UHC event tonight — do not miss it!**",
        "",
        `🕘 Time: **${input.time}**`,
        `🌎 Border: **${input.border}**`,
        `🧱 Version: **${input.version}**`,
        `👥 Team: **${input.team}**`,
        `🌐 IP: \`${input.ip}\``,
        jumpUrl ? `\n🔗 [View the full announcement in ${guildName}](${jumpUrl})` : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
}
