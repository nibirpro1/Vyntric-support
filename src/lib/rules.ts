import { EmbedBuilder } from "discord.js";
import { vyntricEmbed, BRAND } from "./brand";
import { ARENAS } from "../config/tiers";
import { PING_TOLERANCE_MS } from "../config/servers";

/**
 * The published rule text.
 *
 * Transcribed from the server's own ranked-testing rules post so the pinned
 * message and the bot can never drift. Every list here is plain data so a rule
 * change is a one-line edit, not a hunt through a template string.
 */

export const GLOBAL_RULES: string[] = [
  "Only one account is allowed per player. Alternate or shared accounts are forbidden and will lead to punishment.",
  "Do not leave tests mid-round unless necessary. If disconnected, rejoin as soon as possible. Exiting for 15+ minutes without notice results in an automatic forfeit, unless one player has already been warned of a possible leave (which covers both players).",
  "Both players must confirm readiness before the fight begins. Readiness is automatically assumed once damage is exchanged, when an item from the kit is used, or when a player clearly moves toward their opponent.",
  "Do not hit opponents who are clearly lagging, AFK, or frozen before combat has officially begun.",
  "Do not spam or interfere with players during testing.",
  "Do not use teleports (e.g. /tpa, /rtp) without mutual consent. Wait at least 3 seconds after teleporting before attacking.",
  "No use of spectators or teammates to call out armor durability, location, or similar.",
  "The majority of the remaining regulations are outlined in the SS Code. Any failure to familiarize yourself with them is your responsibility, not ours.",
  "Excessive running and buff draining in ranked tier tests is strictly prohibited and doing that will result in a round to the opponent.",
  "Excessive toxicity in a ranked tier test is not allowed and may result in the closure of your ticket (with a cooldown). Examples of toxicity include racism jokes, homophobia, transphobia, and similar behavior.",
  `Players in LT2+ tests (if they are onto the LT2 or above) are required to record their fights / have staff spectating or else the fights will be invalidated.`,
  `Ping parity: both players must be within ${PING_TOLERANCE_MS}ms of each other for the fight to count as ranked.`,
];

export const CHEATING_RULES: string[] = [
  "Account sharing during ranked matches.",
  "Fight rigging (throwing rounds on purpose, colluding to fake results, falsely claiming tests were not official).",
  "Unfair competitive advantage (use of illegal client mods, server-side exploits, external tools).",
  "Obstruction of investigations or intentional delay of action against cheating.",
];

/** Discord's hard limit on an embed description. */
const DESCRIPTION_LIMIT = 4096;

function clamp(text: string) {
  return text.length > DESCRIPTION_LIMIT
    ? `${text.slice(0, DESCRIPTION_LIMIT - 4)}\n…`
    : text;
}

/** The full ranked-testing rules, as one embed. */
export function buildGlobalRulesEmbed(): EmbedBuilder {
  const global = GLOBAL_RULES.map((rule) => `• ${rule}`).join("\n");
  const cheating = CHEATING_RULES.map((rule) => `• ${rule}`).join("\n");

  return vyntricEmbed("primary")
    .setTitle("🏆 Solitary Ranked Testing Rules 🏆")
    .setDescription(
      clamp(
        [
          `*This applies across all Tierlist gamemodes: ${ARENAS.map((a) => a.label).join(", ")}*`,
          "",
          `**🌐 Global Rules (All Gamemodes) 🌐**`,
          global,
          "",
          `**🚫 Cheating & Restrictions 🚫**`,
          "Any player caught cheating, helping others cheat, or withholding critical evidence related to rule violations will face restriction, demotion, and a potential ban from the Discord or testing system.",
          "Continued misconduct during or after a restriction will escalate the punishment to a permanent blacklist.",
          "This includes but is not limited to lying during appeals or misleading staff regarding your actions.",
          "",
          "*What qualifies as cheating or misconduct?*",
          cheating,
          "",
          "*Use common sense. If you need to question it, it is probably not allowed.*",
        ].join("\n")
      )
    )
    .setFooter({ text: BRAND.divider });
}

/**
 * The per-gamemode channel header.
 *
 * One embed per arena, posted into that arena's own channel so a tester opening
 * #netpot sees the netpot rules without hunting for a pinned post elsewhere.
 */
export function buildArenaEmbed(slug: string): EmbedBuilder {
  const arena = ARENAS.find((a) => a.slug === slug);
  if (!arena) throw new Error(`Unknown gamemode: ${slug}`);

  const band = arena.strikeBand;
  const window = band === null ? null : arena.significant[String(band)];

  const fields: Array<{ name: string; value: string; inline: boolean }> = [
    { name: "Kit", value: `${arena.emoji} **${arena.testName}**`, inline: true },
    { name: "Channels", value: arena.channels.map((c) => `\`#${c}\``).join(", "), inline: true },
    {
      name: "Demotion rules",
      value:
        band === null
          ? "None published for this arena."
          : `Judge in **band ${band}** · 3 strikes = one-rung demotion`,
      inline: true,
    },
  ];

  if (window) {
    fields.push({
      name: "Significant loss",
      value: `\`${window.label}\` — losing with **${window.min}+** in a ${window.max}-round fight is 2 strikes.`,
      inline: false,
    });
  }

  if (arena.retireFloor) {
    fields.push({
      name: "Retirement",
      value: `You must hold **${arena.retireFloor} or higher** to retire, for at least 60 days, with 2 or more defences.`,
      inline: false,
    });
  }

  return vyntricEmbed("accent")
    .setTitle(`${arena.emoji} ${arena.label} Testing Rules`)
    .setDescription(arena.blurb)
    .addFields(fields)
    .setFooter({ text: "Ping parity and the global rules apply here too — see the rules channel." });
}

/** The retirement requirements post. */
export function buildRetirementEmbed(): EmbedBuilder {
  return vyntricEmbed("primary")
    .setTitle("🏳️ Solitary Tier Retirement Requirements and Demotion Strikes")
    .setDescription(
      [
        "*This will be a list of the thing you need to have completed before retiring your tier. Make sure to read this carefully.*",
        "",
        "**Retirement**",
        "• To retire, you are required to hold your rank for at least 60 days and have 2 or more defenses. In case there are no players to get defenses against, the player will be assigned a fight with a player of the same or lower / higher tier, which will determine if they are allowed to retire.",
        "",
        "**General Requirements**",
        "• Player must be LT2+ in the gamemode they wish to retire in.",
        "• Player must not have been dodging most tierlist fights they are assigned to.",
        "",
        "**HT3+ Demotions / Strikes**",
        "• Strikes can result in demotions, any loss to someone of the same tier, or someone bridging to the same tier, will result in 1 strike.",
        "• Significant losses are losses with a big score difference. You can find which losses count as significant in the strikes post.",
        "• Every forfeit that results in the opponent passing their test will result in 2 strikes, no matter the tier.",
        "• Extreme losses are when you lose by a 0.2 or 1/5 ratio (ex. 2/10, 3-15). If that happens, you will be instantly demoted to a lower tier.",
        "• Strikes can be removed by beating someone of the same or higher tier or preventing a player of a lower tier from achieving your tier. *(These are called defenses.)*",
        "",
        "*These are the official requirements that are needed to retire as a LT2+ at Solitary. However these can always be changed, so make sure to look back at them every now and then. If you are a really good player which can be vouched by the community, the regulations above can be negotiated based on the gamemode. Otherwise, please proceed to create a ticket if you wish to retire.*",
      ].join("\n")
    );
}
