/**
 * Vyntric Tiers ladder + arena catalogue.
 *
 * This is the one place the ladder is defined. `lib/tiers.ts` re-exports the
 * constants from here so the Discord bot, the slash commands and the website
 * can never drift apart: rename a rung once and every embed, choice list and
 * strike calculation follows.
 */

/** The ten rungs, strongest first. Lower index = better rank. */
export const TIER_LIST = [
  "HT1",
  "LT1",
  "HT2",
  "LT2",
  "HT3",
  "LT3",
  "HT4",
  "LT4",
  "HT5",
  "LT5",
] as const;

export type TierLabel = (typeof TIER_LIST)[number];

export const TIER_FULL: Record<string, string> = {
  HT1: "High Tier 1",
  LT1: "Low Tier 1",
  HT2: "High Tier 2",
  LT2: "Low Tier 2",
  HT3: "High Tier 3",
  LT3: "Low Tier 3",
  HT4: "High Tier 4",
  LT4: "Low Tier 4",
  HT5: "High Tier 5",
  LT5: "Low Tier 5",
};

export const TIER_REGIONS = ["NA", "EU", "AS", "SA", "AU", "ME"] as const;

export type TierRegion = (typeof TIER_REGIONS)[number];

export const REGION_NAMES: Record<string, string> = {
  NA: "North America",
  EU: "Europe",
  AS: "Asia",
  SA: "South America",
  AU: "Oceania",
  ME: "Middle East",
};

/**
 * Discord locale -> Vyntric region.
 *
 * Discord exposes a country on every locale string (`bn-BD`, `en-US`, `de-DE`),
 * and that country is the only region signal a Discord account carries — there is
 * no "where does this player live" field. So `/settier` derives the region from
 * the locale instead of making a tester pick from six buttons every time.
 *
 * Only the countries that actually appear on a Vyntric ladder are listed, rather
 * than all ~250, so the table stays reviewable. The ladder is overwhelmingly
 * South and Southeast Asian, which is why `AS` has a long tail and `ME` has one
 * entry each. An unmapped country is NOT a guess: `regionFromLocale` returns
 * null and the command falls back to the stored region, then to NA, so a missing
 * entry degrades to today's behaviour instead of silently filing a Brazilian
 * player under Europe.
 *
 * `EU` deliberately excludes Russia and Turkey, which Discord locales report as
 * `ru-RU`/`tr-TR`; they are grouped with the Middle East here, matching how the
 * PvP scene actually splits them.
 */
export const LOCALE_REGIONS: Record<string, TierRegion> = {
  // North America
  US: "NA", CA: "NA", MX: "NA",
  // Europe
  GB: "EU", DE: "EU", FR: "EU", ES: "EU", IT: "EU", NL: "EU", PL: "EU",
  SE: "EU", NO: "EU", FI: "EU", DK: "EU", IE: "EU", PT: "EU", CZ: "EU",
  RO: "EU", HU: "EU", GR: "EU", UA: "EU", BY: "EU", LT: "EU", LV: "EU",
  EE: "EU", IS: "EU", BE: "EU", AT: "EU", CH: "EU", RS: "EU", BG: "EU",
  // South America
  BR: "SA", AR: "SA", CL: "SA", CO: "SA", PE: "SA", VE: "SA", EC: "SA",
  UY: "SA", PY: "SA", BO: "SA",
  // Oceania
  AU: "AU", NZ: "AU", FJ: "AU", PG: "AU",
  // Middle East
  SA: "ME", AE: "ME", QA: "ME", KW: "ME", BH: "ME", OM: "ME", JO: "ME",
  LB: "ME", IL: "ME", IR: "ME", IQ: "ME", TR: "ME", RU: "ME", KZ: "ME",
  UZ: "ME", GE: "ME", AM: "ME", AZ: "ME",
  // Asia
  BD: "AS", IN: "AS", PK: "AS", CN: "AS", JP: "AS", KR: "AS", TW: "AS",
  HK: "AS", SG: "AS", MY: "AS", ID: "AS", TH: "AS", VN: "AS", PH: "AS",
  KH: "AS", LA: "AS", MM: "AS", NP: "AS", LK: "AS", MN: "AS", BT: "AS",
  MV: "AS",
};

/**
 * Maps a Discord locale to a Vyntric region, or null when the country is not in
 * the table above.
 *
 * Accepts `bn-BD`, `BD` and `bn-bd` alike: Discord always sends the canonical
 * form, but this is also called with hand-written values in tests, and a locale
 * is the one string in the bot that comes from a human somewhere.
 */
export function regionFromLocale(locale: string | null | undefined): TierRegion | null {
  if (!locale) return null;
  const country = locale.includes("-") ? locale.slice(locale.lastIndexOf("-") + 1) : locale;
  return LOCALE_REGIONS[country.toUpperCase()] ?? null;
}

/**
 * Points awarded for one ranking — mirrors `TIER_POINTS` in the website's
 * assets/data.js exactly, so a Discord leaderboard and the site never disagree.
 */
export const TIER_POINTS: Record<string, number> = {
  "1-0": 100, "1-1": 88,
  "2-0": 76,  "2-1": 62,
  "3-0": 50,  "3-1": 38,
  "4-0": 26,  "4-1": 16,
  "5-0": 9,   "5-1": 4,
};

/**
 * A demotion-strike band.
 *
 * The published retirement rules only govern the top of the ladder, so each
 * arena declares which band it is judged in rather than every arena silently
 * inheriting one. `null` means the arena has no demotion rules at all.
 */
export type StrikeBand = 1 | 2 | 3 | null;

/** A score window that counts as a "significant loss" (worth 2 strikes). */
export interface SignificantWindow {
  /** Losing with this score or higher is significant. */
  min: number;
  /** Length of the fight the window is written for (4, 10, 15 or 20). */
  max: number;
  /** Rendered form used in the rules embed, e.g. "1-4 or 0-4". */
  label: string;
}

export interface Arena {
  /** Stable id. Never rename one without migrating the data file. */
  slug: string;
  /** Display label on the website and in embeds. */
  label: string;
  /** What testers call the kit in a ticket (vanilla is tested as "Crystal"). */
  testName: string;
  emoji: string;
  /** Accent colour, matching the arena mark on the website. */
  color: number;
  /** Channel slugs this arena normally lives in. Purely informational. */
  channels: string[];
  /** Band the demotion-strike rules judge this arena in. */
  strikeBand: StrikeBand;
  /** Lowest rung a player must hold before they may retire from this arena. */
  retireFloor: TierLabel | null;
  /** Significant-loss windows, keyed by strike band as a string. */
  significant: Record<string, SignificantWindow>;
  blurb: string;
}

/** Shorthand: one window that applies to every strike band. */
function allBands(window: SignificantWindow): Record<string, SignificantWindow> {
  return { "1": window, "2": window, "3": window };
}

/** The eight ranked arenas, in website tab order. */
export const ARENAS: Arena[] = [
  {
    slug: "vanilla",
    label: "Vanilla",
    testName: "Crystal",
    emoji: "💎",
    color: 0xa9a5e8,
    channels: ["crystal", "crystal-premium"],
    strikeBand: 3,
    retireFloor: "LT2",
    significant: allBands({ min: 1, max: 4, label: "1-4 or 0-4" }),
    blurb: "Vanilla crystal — no potions, no golden apples. Pure fundamentals in full diamond.",
  },
  {
    slug: "uhc",
    label: "UHC",
    testName: "UHC",
    emoji: "🩸",
    color: 0xd44e50,
    channels: ["uhc"],
    strikeBand: 3,
    retireFloor: "LT2",
    significant: allBands({ min: 5, max: 10, label: "5-10 to 0-10" }),
    blurb: "Ultra Hardcore — only golden apples and heads heal you. Positioning decides it.",
  },
  {
    slug: "pot",
    label: "Pot",
    testName: "Diamond Pot",
    emoji: "🍯",
    color: 0xc889e6,
    channels: ["diapot", "pot"],
    strikeBand: 2,
    retireFloor: "LT2",
    // The published table narrows this one at the very top of the ladder.
    significant: {
      "1": { min: 9, max: 15, label: "9-15 to 0-15" },
      "2": { min: 5, max: 10, label: "5-10 to 0-10" },
      "3": { min: 5, max: 10, label: "5-10 to 0-10" },
    },
    blurb: "Pot — splash instant health and speed II. The fastest kit on the ladder.",
  },
  {
    slug: "nethop",
    label: "NethOP",
    testName: "Netherite Pot",
    emoji: "🔮",
    color: 0x8a68a8,
    channels: ["netpot", "nethop"],
    strikeBand: 3,
    retireFloor: "LT2",
    significant: allBands({ min: 1, max: 4, label: "1-4 or 0-4" }),
    blurb: "Netherite OP — netherite pot with fully enchanted gear. The highest tier ceiling.",
  },  {
    slug: "smp",
    label: "SMP",
    testName: "Diamond SMP",
    emoji: "⛏️",
    color: 0x1aa894,
    channels: ["diasmp", "smpkit", "main-smp"],
    strikeBand: 3,
    retireFloor: "LT2",
    significant: allBands({ min: 1, max: 4, label: "1-4 or 0-4" }),
    blurb: "SMP — survival kit with limited healing. Every golden apple is a real decision.",
  },
  {
    slug: "sword",
    label: "Sword",
    testName: "Sword",
    emoji: "🗡️",
    color: 0x7cc7ec,
    channels: ["sword", "netsword"],
    strikeBand: 1,
    retireFloor: "LT2",
    // The published table narrows this one below the very top of the ladder.
    significant: {
      "1": { min: 14, max: 20, label: "14-20 to 0-20" },
      "2": { min: 5, max: 10, label: "5-10 to 0-10" },
      "3": { min: 5, max: 10, label: "5-10 to 0-10" },
    },
    blurb: "Sword — netherite sword and shield only, no bow. Pure W-tapping and shield timing.",
  },
  {
    slug: "axe",
    label: "Axe",
    testName: "Axe & Shield",
    emoji: "🪓",
    color: 0x7cc7ec,
    channels: ["tank", "axe"],
    strikeBand: 1,
    retireFloor: "LT2",
    significant: allBands({ min: 14, max: 20, label: "14-20 to 0-20" }),
    blurb: "Axe — netherite axe with shield. Shield-breaking and burst damage windows.",
  },
  {
    slug: "mace",
    label: "Mace",
    testName: "Mace",
    emoji: "🔱",
    color: 0x9aa4b2,
    channels: ["mace"],
    strikeBand: 3,
    retireFloor: "LT2",
    significant: allBands({ min: 5, max: 10, label: "5-10 to 0-10" }),
    blurb: "Mace — wind charge mobility plus mace smash. The newest kit and fastest churn.",
  },
];
export const ARENA_BY_SLUG: Record<string, Arena> = Object.fromEntries(
  ARENAS.map((a) => [a.slug, a])
);

export function arena(slug: string): Arena | undefined {
  return ARENA_BY_SLUG[slug];
}

/** `[slug, label]` pairs, exactly the shape every slash command choice expects. */
export const TIER_MODES: Array<[string, string]> = ARENAS.map((a) => [a.slug, a.label]);

/** Splits a stored tier index back into its `HT1..LT5` components. */
export function splitIndex(index: number): { tier: number; pos: number; label: TierLabel } {
  const tier = Math.floor(index / 2) + 1;
  const pos = index % 2 === 0 ? 0 : 1;
  return { tier, pos, label: TIER_LIST[index] };
}

/** `"HT3"` -> `3`. Returns null for anything that is not a rung. */
export function tierBand(label: string): number | null {
  const match = /^(?:HT|LT)(\d)$/i.exec(label.trim());
  if (!match) return null;
  const tier = Number.parseInt(match[1], 10);
  return tier >= 1 && tier <= 5 ? tier : null;
}

/** Strikes are only published for these three bands. */
export const STRIKE_BANDS: StrikeBand[] = [1, 2, 3];

/** How many accumulated strikes demote a player. */
export const DEMOTION_THRESHOLD = 3;