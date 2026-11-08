import fs from "fs";
import path from "path";
import { getBrandIcon, vyntricEmbed } from "./brand";
import {
  ARENAS,
  ARENA_BY_SLUG,
  LOCALE_REGIONS,
  REGION_NAMES,
  TIER_FULL,
  TIER_LIST,
  TIER_MODES,
  TIER_POINTS,
  TIER_REGIONS,
  arena,
  regionFromLocale,
  splitIndex,
  tierBand,
} from "../config/tiers";

/**
 * Vyntric Tiers integration.
 *
 * `/settier` writes the tiers website's live data file
 * (`vyntric-tiers-v8/assets/data.json`, atomic write like store.ts) and posts
 * the MCTIERS-style result embed. The website polls the file every 30 seconds,
 * so the rankings update automatically.
 *
 * The ladder itself (rungs, labels, points, arena metadata) lives in
 * `config/tiers.ts` and is re-exported below, so there is exactly one place a
 * rank is defined.
 */
export {
  TIER_LIST,
  TIER_FULL,
  TIER_MODES,
  TIER_REGIONS,
  REGION_NAMES,
  TIER_POINTS,
  ARENAS,
  ARENA_BY_SLUG,
  LOCALE_REGIONS,
  regionFromLocale,
  arena,
  splitIndex,
  tierBand,
};
export type { TierRegion } from "../config/tiers";

/**
 * Picks the region a result should be filed under, most specific source first:
 *
 *   1. what the tester typed in the `region` option,
 *   2. the player's existing region, so a `/settier` on a ranked player never
 *      silently moves them across the ladder,
 *   3. the Discord account's locale, which is the auto-detection,
 *   4. `NA`, the historical default.
 *
 * Locale is consulted AFTER the stored region on purpose. A player's region is a
 * decision somebody made; their Discord locale is a language setting that can
 * change to English without them ever leaving the country. Overwriting a stored
 * region on every re-test because someone switched their client to en-US would
 * be a far worse bug than defaulting a brand-new player to the wrong continent,
 * which the tester can correct with one option.
 */
export function resolveRegion(input: {
  chosen?: string | null;
  stored?: string | null;
  locale?: string | null;
}): string {
  if (input.chosen) return input.chosen;
  if (input.stored) return input.stored;
  return regionFromLocale(input.locale) ?? "NA";
}

/** A tier index, or null when the player holds no ranking in that gamemode. */
export function rankingIndex(view: TierView | undefined, gamemode: string): number | null {
  const ranking = view?.rankings.find((r) => r.slug === gamemode);
  if (!ranking) return null;
  // `ranking.tier`/`pos` are the parts; the index is what the data file stores.
  return (ranking.tier - 1) * 2 + ranking.pos;
}

export function modeLabel(key: string): string {
  return ARENA_BY_SLUG[key]?.label ?? key;
}

/** What testers call the kit in a ticket — vanilla is tested as "Crystal". */
export function testName(key: string): string {
  return ARENA_BY_SLUG[key]?.testName ?? modeLabel(key);
}

export function tierPoints(tier: number, pos: number): number {
  return TIER_POINTS[`${tier}-${pos}`] ?? 0;
}

/** Combat titles derived from total points, same thresholds as the website. */
const TITLES: Array<{ at: number; title: string }> = [
  { at: 400, title: "Combat Grandmaster" },
  { at: 250, title: "Combat Master" },
  { at: 150, title: "Combat Ace" },
  { at: 60, title: "Combat Duelist" },
  { at: 0, title: "Combat Rookie" },
];

export function titleFor(points: number): string {
  for (const t of TITLES) if (points >= t.at) return t.title;
  return TITLES[TITLES.length - 1].title;
}

/**
 * The next rung down from `label`, or null when already at the bottom.
 *
 * Used by the demotion flow: a player who crosses the strike threshold drops
 * exactly one rung rather than being removed from the ladder.
 */
export function demoteTier(label: string): string | null {
  const index = TIER_LIST.indexOf(label as (typeof TIER_LIST)[number]);
  if (index < 0 || index >= TIER_LIST.length - 1) return null;
  return TIER_LIST[index + 1];
}

/** Are two rungs in the same strike band (1, 2 or 3)? */
export function sameBand(a: string, b: string): boolean {
  const bandA = tierBand(a);
  const bandB = tierBand(b);
  return bandA !== null && bandA === bandB;
}

interface TierPlayer {
  name: string;
  region: string;
  tiers: Record<string, number>;
  /** Best tier ever earned per gamemode - points come from the peak, like MCTIERS. */
  peaks?: Record<string, number>;
}

interface TierTest {
  name: string;
  gamemode: string;
  tier: number;
  prev: number | null;
  tester: string;
  at: number;
}

interface TiersData {
  version: number;
  updatedAt: number;
  players: TierPlayer[];
  tests: TierTest[];
}

/** Default: the sibling checkout; override with TIERS_DATA_JSON in .env. */
function dataFile(): string {
  if (process.env.TIERS_DATA_JSON) return path.resolve(process.env.TIERS_DATA_JSON);
  return path.join(__dirname, "..", "..", "..", "vyntric-tiers-v8", "assets", "data.json");
}

export function tiersDataFile(): string {
  return dataFile();
}

function readData(): TiersData {
  try {
    const raw = fs.readFileSync(dataFile(), "utf8").trim();
    if (!raw) throw new Error("empty tiers data file");
    const parsed = JSON.parse(raw) as Partial<TiersData>;
    return {
      version: parsed.version ?? 0,
      updatedAt: parsed.updatedAt ?? 0,
      players: Array.isArray(parsed.players) ? parsed.players : [],
      tests: Array.isArray(parsed.tests) ? parsed.tests : [],
    };
  } catch {
    return { version: 0, updatedAt: 0, players: [], tests: [] };
  }
}

export interface SetTierInput {
  username: string;
  gamemode: string;
  tier: string;
  region?: string | null;
  tester: string;
}

export interface SetTierResult {
  created: boolean;
  previous: number | null;
  current: number;
  region: string;
  version: number;
  file: string;
}

/** Applies a tier, records the test and persists the website data file. */
export function applyTier(input: SetTierInput): SetTierResult {
  const mode = TIER_MODES.find(([key]) => key === input.gamemode);
  if (!mode) throw new Error(`Unknown gamemode: ${input.gamemode}`);
  const current = TIER_LIST.indexOf(input.tier as (typeof TIER_LIST)[number]);
  if (current < 0) throw new Error(`Unknown tier: ${input.tier}`);

  const username = input.username.trim();
  if (!username) throw new Error("Username is required");

  const data = readData();
  let player = data.players.find((p) => p.name.toLowerCase() === username.toLowerCase());
  const created = !player;
  if (!player) {
    player = { name: username, region: input.region || "NA", tiers: {} };
    data.players.push(player);
  }

  const region = input.region || player.region || "NA";
  const previous = typeof player.tiers[input.gamemode] === "number" ? player.tiers[input.gamemode] : null;
  player.tiers[input.gamemode] = current;
  player.peaks = player.peaks || {};
  const peak = player.peaks[input.gamemode];
  // Lower index = better tier, so the peak only ever improves.
  if (typeof peak !== "number" || current < peak) player.peaks[input.gamemode] = current;
  player.region = region;

  data.version += 1;
  data.updatedAt = Math.floor(Date.now() / 1000);
  data.tests = [
    {
      name: username,
      gamemode: input.gamemode,
      tier: current,
      prev: previous,
      tester: input.tester,
      at: data.updatedAt,
    },
    ...data.tests,
  ].slice(0, 50);

  const file = dataFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, file);

  return { created, previous, current, region, version: data.version, file };
}

/** MCTIERS-style result embed posted in the results channel. */
export function buildTierResultEmbed(args: {
  username: string;
  region: string;
  gamemodeLabel: string;
  previous: number | null;
  current: number;
  testerMention: string;
}) {
  return vyntricEmbed("accent")
    .setTitle(`${args.username}'s Test Results 🏆`)
    .setThumbnail(`https://mc-heads.net/avatar/${encodeURIComponent(args.username)}/96`)
    .addFields(
      { name: "Tester", value: args.testerMention, inline: true },
      { name: "Region", value: args.region, inline: true },
      { name: "Username", value: args.username, inline: true },
      { name: "Previous Rank", value: args.previous === null ? "Unranked" : TIER_FULL[TIER_LIST[args.previous]], inline: true },
      { name: "Rank Earned", value: TIER_FULL[TIER_LIST[args.current]], inline: true },
      { name: "Gamemode", value: args.gamemodeLabel, inline: true }
    )
    .setFooter({ text: "Vyntric Tiers - rankings updated on the website", iconURL: getBrandIcon() });
}


/* ============================================================================
   Read + mutate layer
   ----------------------------------------------------------------------------
   Everything above this line is the original `/settier` write path. Everything
   below backs the rest of the `/tier` command family: the same data file, read
   through one shared helper so a lookup and a write can never disagree.
   ========================================================================== */

/** Public snapshot of one player, already resolved to labels and points. */
export interface TierView {
  name: string;
  region: string;
  /** One entry per gamemode the player is ranked in, strongest first. */
  rankings: Array<{
    slug: string;
    label: string;
    labelTitle: string;
    tier: number;
    pos: number;
    retired: boolean;
    peak: string | null;
    points: number;
  }>;
  points: number;
  title: string;
  overall: number;
}

function toView(player: TierPlayer): TierView {
  const rankings: TierView["rankings"] = [];
  let points = 0;
  for (const slug of Object.keys(player.tiers).sort()) {
    const current = player.tiers[slug];
    const peak = player.peaks?.[slug];
    // Lower index = better rung, so the peak only ever improves.
    const shownIndex = typeof peak === "number" && peak < current ? peak : current;
    const { tier, pos, label } = splitIndex(shownIndex);
    const pts = tierPoints(tier, pos);
    points += pts;
    rankings.push({
      slug,
      label,
      labelTitle: TIER_FULL[label],
      tier,
      pos,
      retired: typeof peak === "number" && peak < current,
      peak: typeof peak === "number" ? TIER_LIST[peak] : null,
      points: pts,
    });
  }
  return {
    name: player.name,
    region: player.region,
    rankings,
    points,
    title: titleFor(points),
    overall: 0,
  };
}

/** Every player, resolved and sorted best-first. `overall` is 1-based. */
export function leaderboard(): TierView[] {
  const views = readData().players.map(toView);
  views.sort((a, b) => b.points - a.points || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  views.forEach((v, i) => (v.overall = i + 1));
  return views;
}

/** Case-insensitive exact-then-prefix lookup, mirroring the website's search. */
export function findPlayer(name: string): TierView | null {
  const q = String(name || "").trim().toLowerCase();
  if (!q) return null;
  const all = leaderboard();
  const exact = all.find((p) => p.name.toLowerCase() === q);
  if (exact) return exact;
  return all.find((p) => p.name.toLowerCase().startsWith(q)) ?? null;
}

/** Substring search for `/tier search`. */
export function searchPlayers(query: string, limit = 10): TierView[] {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  const starts: TierView[] = [];
  const has: TierView[] = [];
  for (const p of leaderboard()) {
    const n = p.name.toLowerCase();
    if (n.startsWith(q)) starts.push(p);
    else if (n.includes(q)) has.push(p);
  }
  return starts.concat(has).slice(0, limit);
}

/** Top N of one gamemode, strongest rung first. */
export function topOfMode(gamemode: string, limit = 10): TierView[] {
  return leaderboard()
    .filter((p) => p.rankings.some((r) => r.slug === gamemode))
    .sort((a, b) => {
      const ra = a.rankings.find((x) => x.slug === gamemode)!;
      const rb = b.rankings.find((x) => x.slug === gamemode)!;
      return ra.tier - rb.tier || ra.pos - rb.pos || b.points - a.points;
    })
    .slice(0, limit);
}

/** How many players hold a ranking in each gamemode. */
export function modeCounts(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key] of TIER_MODES) out[key] = 0;
  for (const p of leaderboard()) {
    for (const r of p.rankings) out[r.slug] = (out[r.slug] ?? 0) + 1;
  }
  return out;
}

/** The most recent tests across every gamemode, newest first. */
export function recentTests(limit = 15) {
  return readData().tests.slice(0, limit);
}

/** The recent test history of one player. */
export function playerTests(name: string, limit = 10) {
  const q = name.trim().toLowerCase();
  return readData().tests.filter((t) => t.name.toLowerCase() === q).slice(0, limit);
}

/** Writes the data file back atomically — same guarantee as `applyTier`. */
function save(data: TiersData): string {
  const file = dataFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, file);
  return file;
}

function findOrThrow(data: TiersData, name: string): TierPlayer {
  const q = name.trim().toLowerCase();
  const player = data.players.find((p) => p.name.toLowerCase() === q);
  if (!player) throw new Error(`No player called "${name}" is ranked on Vyntric.`);
  return player;
}

/**
 * Drops one ranking, or the whole player when `gamemode` is omitted. A player
 * left with nothing is removed entirely so the ladder never shows empty rows.
 */
export function removeTier(
  username: string,
  gamemode?: string | null
): { removed: number; file: string } {
  const data = readData();
  const player = findOrThrow(data, username);
  const before = Object.keys(player.tiers).length;
  if (gamemode) {
    if (typeof player.tiers[gamemode] !== "number") {
      throw new Error(`${player.name} has no ${modeLabel(gamemode)} ranking.`);
    }
    delete player.tiers[gamemode];
    if (player.peaks) delete player.peaks[gamemode];
  } else {
    player.tiers = {};
    player.peaks = {};
  }
  const removed = before - Object.keys(player.tiers).length;
  if (!Object.keys(player.tiers).length) {
    data.players = data.players.filter((p) => p !== player);
  }
  data.version += 1;
  data.updatedAt = Math.floor(Date.now() / 1000);
  return { removed, file: save(data) };
}

/** Retires a player from one gamemode, freezing the peak they held. */
export function retirePlayer(username: string, gamemode: string): { peak: string; file: string } {
  const data = readData();
  const player = findOrThrow(data, username);
  const current = player.tiers[gamemode];
  if (typeof current !== "number") {
    throw new Error(`${player.name} has no ${modeLabel(gamemode)} ranking.`);
  }
  player.peaks = player.peaks ?? {};
  const existing = player.peaks[gamemode];
  if (typeof existing !== "number" || current < existing) player.peaks[gamemode] = current;
  data.version += 1;
  data.updatedAt = Math.floor(Date.now() / 1000);
  return { peak: TIER_LIST[player.peaks[gamemode]], file: save(data) };
}

/** Moves a player to a different region. */
export function setRegion(username: string, region: string): { region: string; file: string } {
  const data = readData();
  const player = findOrThrow(data, username);
  player.region = region;
  data.version += 1;
  data.updatedAt = Math.floor(Date.now() / 1000);
  return { region, file: save(data) };
}