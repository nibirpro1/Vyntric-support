/**
 * Vyntric Tiers domain self-check.
 *
 * Proves the parts that are pure logic and therefore worth proving without a
 * gateway: the published strike table, duration parsing, ping parity, the arena
 * catalogue's internal consistency, and the rule embeds staying inside Discord's
 * hard limits.
 *
 * Run with: npm run verify:tiers
 */
import { ARENAS, DEMOTION_THRESHOLD, LOCALE_REGIONS, TIER_LIST, TIER_REGIONS, regionFromLocale, tierBand } from "../config/tiers";
import { STAFF_ROLES, FORBIDDEN_PERMISSIONS, permissionBitfield } from "../config/staff";
import { PUNISHMENTS, formatDuration, parseDurationDays } from "../config/punishments";
import { checkPing, PING_TOLERANCE_MS } from "../config/servers";
import {
  BAND_RULES,
  EXTREME_LOSS_RATIO,
  FORFEIT_PASS_STRIKES,
  isExtremeLoss,
  isSignificantLoss,
  scoreRatio,
  shouldDemote,
  strikeBar,
  strikesForFight,
  totalStrikes,
} from "../lib/strikes";
import { buildArenaEmbed, buildGlobalRulesEmbed, buildRetirementEmbed } from "../lib/rules";
import { demoteTier, resolveRegion, sameBand } from "../lib/tiers";

let passed = 0;
let failed = 0;

function ok(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`OK   ${name}${detail ? ` (${detail})` : ""}`);
  } else {
    failed += 1;
    console.error(`FAIL ${name}${detail ? ` (${detail})` : ""}`);
  }
}

function eq(name: string, actual: unknown, expected: unknown) {
  ok(name, Object.is(actual, expected), `got ${String(actual)}, want ${String(expected)}`);
}

/* ── ladder ────────────────────────────────────────────────────────────────── */
eq("the ladder holds exactly ten rungs", TIER_LIST.length, 10);
eq("the ladder starts at HT1", TIER_LIST[0], "HT1");
eq("the ladder ends at LT5", TIER_LIST[TIER_LIST.length - 1], "LT5");
ok("every rung in the ladder is unique", new Set(TIER_LIST).size === TIER_LIST.length);
eq("HT3 parses to band 3", tierBand("HT3"), 3);
eq("LT2 parses to band 2", tierBand("LT2"), 2);
eq("garbage does not parse to a band", tierBand("banana"), null);
eq("demoting LT4 lands on HT5", demoteTier("LT4"), "HT5");
eq("LT5 cannot be demoted further", demoteTier("LT5"), null);
ok("LT2 and HT2 share a band", sameBand("LT2", "HT2"));
ok("LT2 and LT3 are different bands", !sameBand("LT2", "LT3"));

/* ── arena catalogue ───────────────────────────────────────────────────────── */
eq("there are eight ranked arenas", ARENAS.length, 8);
ok("every arena slug is unique", new Set(ARENAS.map((a) => a.slug)).size === ARENAS.length);
ok(
  "every arena has a significant window for its own band",
  ARENAS.every((a) => a.strikeBand === null || Boolean(a.significant[String(a.strikeBand)]))
);
ok("every arena blurb fits an embed description", ARENAS.every((a) => a.blurb.length <= 4096));
ok("vanilla is tested as Crystal", ARENAS.find((a) => a.slug === "vanilla")?.testName === "Crystal");

/* ── the published strike table ────────────────────────────────────────────── */
/* These are the exact numbers from the server's retirement-demotions post, so
   a rule change there has to be made here too, deliberately. */
eq("band 1 loss is 1 strike", BAND_RULES[1].lossSameTier, 1);
eq("band 1 loss to a lower tier is 3 strikes", BAND_RULES[1].lossLowerTier, 3);
eq("band 1 dodging is 2 strikes", BAND_RULES[1].dodge, 2);
eq("band 2 loss to a lower tier is 2 strikes", BAND_RULES[2].lossLowerTier, 2);
eq("band 2 dodging is 1 strike", BAND_RULES[2].dodge, 1);
eq("band 3 loss to a lower tier is 2 strikes", BAND_RULES[3].lossLowerTier, 2);
eq("band 3 publishes no dodging rule", BAND_RULES[3].dodge, null);
eq("a forfeit that passes the opponent is 2 strikes", FORFEIT_PASS_STRIKES, 2);
eq("3 strikes cause a demotion", DEMOTION_THRESHOLD, 3);

/* ── the engine agrees with the table ──────────────────────────────────────── */
type Fight = Parameters<typeof strikesForFight>[0];
const loss = (band: 1 | 2 | 3, over: Partial<Fight>) =>
  totalStrikes(
    strikesForFight({
      band,
      won: false,
      sameTier: true,
      vsLowerTier: false,
      significant: false,
      extreme: false,
      ...over,
    })
  );

eq("a plain same-tier loss is 1 strike", loss(1, {}), 1);
eq("a loss to a lower tier at band 1 is 3", loss(1, { vsLowerTier: true }), 3);
eq("a loss to a lower tier at band 2 is 2", loss(2, { vsLowerTier: true }), 2);
eq("a significant loss is 2", loss(1, { significant: true }), 2);
eq("a lower-tier loss outranks the significant bonus", loss(1, { vsLowerTier: true, significant: true }), 3);
eq("band 3 dodging is not scored", loss(3, { dodged: true }), 1);
eq("band 1 dodging adds on top of the loss", loss(1, { dodged: true }), 3);
eq("a forfeit that passes adds 2 on top", loss(3, { opponentPassed: true }), 3);
eq("an extreme loss scores 0 and flags itself", loss(1, { extreme: true }), 0);
ok(
  "an extreme loss is reported by its own code",
  strikesForFight({ band: 1, won: false, sameTier: true, vsLowerTier: false, significant: false, extreme: true })[0].code === "extreme_loss"
);
eq("a win at the same tier removes 1 strike", loss(1, { won: true, sameTier: true }), -1);
eq("a win is not scored even when flagged significant", loss(1, { won: true, significant: true }), -1);

ok("2 strikes do not demote", !shouldDemote(2));
ok("3 strikes demote", shouldDemote(3));
ok("4 strikes still demote", shouldDemote(4));
eq("an empty strike bar shows three dots", strikeBar(0), "···");
eq("a full strike bar shows three swords", strikeBar(3), "⚔️⚔️⚔️");
eq("the strike bar caps at three", strikeBar(9), "⚔️⚔️⚔️");
eq("a negative balance cannot print negative swords", strikeBar(-2), "···");

/* ── score maths ───────────────────────────────────────────────────────────── */
eq("2/10 is exactly the extreme ratio", scoreRatio(2, 10), 0.2);
ok("2/10 is an extreme loss", isExtremeLoss(2, 10));
ok("3/15 is an extreme loss", isExtremeLoss(3, 15));
ok("4/10 is not extreme", !isExtremeLoss(4, 10));
ok("a zero win score is not a ratio", scoreRatio(0, 0) === null);
ok("a negative score is not a ratio", scoreRatio(-1, 10) === null);
ok("14 in a 20 fight is a significant sword loss", isSignificantLoss({ min: 14, max: 20 }, 14));
ok("13 in a 20 fight is not", !isSignificantLoss({ min: 14, max: 20 }, 13));
ok("a missing window is never significant", !isSignificantLoss(undefined, 99));
eq("the extreme ratio is 0.2", EXTREME_LOSS_RATIO, 0.2);

/* ── punishment durations ──────────────────────────────────────────────────── */
eq("90 days parses", parseDurationDays("90d"), 90);
eq("90 days spelled out parses", parseDurationDays("90 days"), 90);
eq("two weeks parses to 14 days", parseDurationDays("2 weeks"), 14);
eq("36 hours parses to 1.5 days", parseDurationDays("36h"), 1.5);
eq("6 months parses to 180 days", parseDurationDays("6 months"), 180);
eq("nonsense does not parse", parseDurationDays("soon"), null);
eq("a negative duration does not parse", parseDurationDays("-5d"), null);
eq("1 day is singular", formatDuration(1), "1 Day");
eq("90 days is plural", formatDuration(90), "90 Days");
eq("a fractional day keeps the decimal", formatDuration(1.5), "1.5 Days");

/* ── staff roles ───────────────────────────────────────────────────────────── */
eq("there are four staff rungs", STAFF_ROLES.length, 4);
ok(
  "staff ranks strictly increase",
  STAFF_ROLES.every((role, i) => i === 0 || role.rank > STAFF_ROLES[i - 1].rank)
);
ok(
  "no staff role carries Administrator or Manage Server",
  STAFF_ROLES.every((role) => !role.permissions.some((p) => FORBIDDEN_PERMISSIONS.includes(p)))
);
ok(
  "the tester role is the weakest rung",
  STAFF_ROLES[0].key === "tester" && STAFF_ROLES[0].rank === 10
);
ok("every role declares the channels it serves", STAFF_ROLES.every((role) => role.channels.length > 0));
ok(
  "a permission bitfield renders as a positive integer string",
  /^\d+$/.test(permissionBitfield(STAFF_ROLES[0].permissions))
);

/* ── ping parity ───────────────────────────────────────────────────────────── */
ok("equal pings are fair", checkPing(150, 150).fair);
ok("a 20ms gap is exactly fair", checkPing(150, 170).fair);
ok("a 21ms gap is not fair", !checkPing(150, 171).fair);
ok("a 15ms gap asks for a spoof", checkPing(155, 170).spoofRequired);
ok("a 5ms gap needs no spoof", !checkPing(155, 160).spoofRequired);
ok("a huge gap cannot be spoofed away", !checkPing(20, 400).spoofRequired);
eq("the tick range is reported low first", checkPing(170, 155).range.low, 155);
eq("the tolerance is 20ms", PING_TOLERANCE_MS, 20);

/* ── rule embeds must fit Discord's hard limits ────────────────────────────── */
const globalRules = buildGlobalRulesEmbed().toJSON();
const retirement = buildRetirementEmbed().toJSON();
const sword = buildArenaEmbed("sword").toJSON();
const embeds = [globalRules, retirement, sword];

ok(
  "the global rules fit a Discord description",
  (globalRules.description?.length ?? 0) <= 4096,
  `${globalRules.description?.length} chars`
);
ok(
  "the retirement rules fit a Discord description",
  (retirement.description?.length ?? 0) <= 4096,
  `${retirement.description?.length} chars`
);
ok("the global rules have a title", Boolean(globalRules.title));
ok("every arena embed builds", ARENAS.every((a) => Boolean(buildArenaEmbed(a.slug).toJSON().title)));
ok(
  "no embed field exceeds the 1024 char value limit",
  embeds.every((e) => (e.fields ?? []).every((field: any) => field.value.length <= 1024))
);
ok(
  "no embed field name exceeds the 256 char limit",
  embeds.every((e) => (e.fields ?? []).every((field: any) => field.name.length <= 256))
);
eq("the punishment catalogue has three kinds", Object.keys(PUNISHMENTS).length, 3);

/* ——————————————————————————————————————— region auto-detection ———————————————
   `/settier` and `/tier set` fill an omitted `region` from the player's Discord
   locale, so this mapping is load-bearing: a wrong entry files somebody on the
   wrong continent's ladder permanently. These pin the precedence as much as the
   table, because the precedence is where the silent mistakes live. */
ok(
  "every mapped country lands on a real region",
  Object.values(LOCALE_REGIONS).every((r) => TIER_REGIONS.includes(r))
);
ok("the region table is not empty", Object.keys(LOCALE_REGIONS).length > 0);

/* the locales Vyntric actually sees */
eq("bn-BD is Asia", regionFromLocale("bn-BD"), "AS");
eq("en-US is North America", regionFromLocale("en-US"), "NA");
eq("en-GB is Europe", regionFromLocale("en-GB"), "EU");
eq("pt-BR is South America", regionFromLocale("pt-BR"), "SA");
eq("en-AU is Oceania", regionFromLocale("en-AU"), "AU");
eq("ar-SA is the Middle East", regionFromLocale("ar-SA"), "ME");

/* a bare country code and an odd case are both accepted */
eq("a bare country code works", regionFromLocale("BD"), "AS");
eq("a lowercase locale works", regionFromLocale("bn-bd"), "AS");

/* unknown and missing input must NOT guess */
eq("an unmapped country returns null", regionFromLocale("en-ZZ"), null);
eq("a null locale returns null", regionFromLocale(null), null);
eq("an undefined locale returns null", regionFromLocale(undefined), null);
eq("an empty locale returns null", regionFromLocale(""), null);

/* precedence: chosen > stored > locale > NA */
eq("an explicit region wins over everything",
  resolveRegion({ chosen: "EU", stored: "SA", locale: "bn-BD" }), "EU");
eq("a stored region wins over the locale",
  resolveRegion({ stored: "SA", locale: "bn-BD" }), "SA");
eq("the locale fills in for a new player",
  resolveRegion({ locale: "bn-BD" }), "AS");
eq("an unmapped locale falls back to NA",
  resolveRegion({ locale: "en-ZZ" }), "NA");
eq("no signal at all falls back to NA", resolveRegion({}), "NA");
eq("a null chosen region is treated as absent",
  resolveRegion({ chosen: null, locale: "bn-BD" }), "AS");

console.log(`\n${passed}/${passed + failed} tier-domain checks passed.`);
if (failed) process.exit(1);
