/**
 * Proves the `/tier` command surface without touching Discord.
 *
 *   npx ts-node src/tools/verify-tier-commands.ts
 *
 * Checks the slash-command payload is deployable (Discord's own limits: names,
 * descriptions, choice counts) and exercises the read layer against a temporary
 * data file so nothing on the live ladder is modified.
 */
import fs from "fs";
import os from "os";
import path from "path";

/* point the data layer at a throwaway file before anything imports it */
const tmp = path.join(os.tmpdir(), `vyntric-tier-verify-${process.pid}.json`);
process.env.TIERS_DATA_JSON = tmp;

import { collectCommandPayloads } from "../lib/commandPayloads";
import {
  TIER_FULL,
  TIER_LIST,
  TIER_MODES,
  applyTier,
  findPlayer,
  leaderboard,
  modeCounts,
  removeTier,
  retirePlayer,
  searchPlayers,
  setRegion,
  tierPoints,
  topOfMode,
} from "../lib/tiers";

let failed = 0;
function ok(cond: unknown, label: string) {
  if (cond) console.log("  ok   " + label);
  else {
    failed += 1;
    console.log("  FAIL " + label);
  }
}

console.log("\n=== 1 - slash command payload ===");
const payloads = collectCommandPayloads();
const tier = payloads.find((p: any) => p.name === "tier");
ok(!!tier, "/tier is collected by the deploy script");
ok(!!payloads.find((p: any) => p.name === "settier"), "/settier is still registered");

const subs: any[] = tier.options;
console.log(`  info  ${subs.length} subcommands: ${subs.map((s) => s.name).join(", ")}`);
ok(subs.length === 14, "all 14 subcommands present");
ok(subs.every((s) => /^[a-z][a-z0-9_-]{0,31}$/.test(s.name)), "every subcommand name is Discord-legal");
ok(subs.every((s) => typeof s.description === "string" && s.description.length <= 100),
  "every subcommand has a description within 100 chars");
ok(new Set(subs.map((s) => s.name)).size === subs.length, "no duplicate subcommand names");

const READ = ["profile", "top", "leaderboard", "ranks", "ladder", "modes", "search", "tests", "stats", "help"];
const WRITE = ["set", "remove", "retire", "region"];
for (const name of READ) ok(subs.some((s) => s.name === name), `public subcommand: ${name}`);
for (const name of WRITE) ok(subs.some((s) => s.name === name), `staff subcommand: ${name}`);

/* Discord caps a command at 25 options and 25 choices per option */
ok(subs.every((s) => (s.options ?? []).length <= 25), "no subcommand exceeds 25 options");
for (const s of subs) {
  for (const o of s.options ?? []) {
    if (!o.choices) continue;
    ok(o.choices.length <= 25, `${s.name}/${o.name} has <= 25 choices (${o.choices.length})`);
    ok(o.choices.every((c: any) => c.name && c.value), `${s.name}/${o.name} choices are fully named`);
  }
}

console.log("\n=== 2 - tier maths matches the website ===");
ok(TIER_LIST.length === 10, "the ladder has ten rungs");
ok(TIER_MODES.length === 8, "eight arenas");
ok(tierPoints(1, 0) === 100 && tierPoints(1, 1) === 88, "HT1 = 100, LT1 = 88");
ok(tierPoints(5, 1) === 4, "LT5 = 4 points");
ok(TIER_LIST.every((v) => TIER_FULL[v]), "every rung has a full name");

console.log("\n=== 3 - write + read round trip ===");
const r1 = applyTier({ username: "TestHero", gamemode: "sword", tier: "HT1", region: "EU", tester: "Tester" });
ok(r1.created === true && r1.previous === null, "a brand new player is created, unranked before");
const r2 = applyTier({ username: "TestHero", gamemode: "sword", tier: "LT2", region: "EU", tester: "Tester" });
ok(r2.previous === 0 && r2.current === 3, "the previous rung is remembered");

const hero = findPlayer("testhero");
ok(!!hero, "lookup is case-insensitive");
ok(hero?.rankings.length === 1, "the player holds one ranking");
ok(hero?.rankings[0].label === "LT2", "the current rung reads back correctly");
ok(hero?.rankings[0].retired === true, "HT1 became the frozen peak, so the rung reads retired");
ok(hero?.rankings[0].peak === "HT1", "the peak is HT1");
ok(hero?.points === tierPoints(2, 1), "points are taken from the shown (peak) rung");
ok(hero?.overall === 1, "the only player is #1 overall");
ok(leaderboard().length === 1, "the leaderboard holds one player");
ok(modeCounts().sword === 1, "the arena counter sees the ranking");
ok(topOfMode("sword", 5)[0]?.name === "TestHero", "top-of-mode returns the player");
ok(searchPlayers("testh").length === 1, "substring search finds them");

setRegion("TestHero", "AS");
ok(findPlayer("TestHero")?.region === "AS", "region change persists");
retirePlayer("TestHero", "sword");
ok(findPlayer("TestHero")?.rankings[0].retired === true, "retire is idempotent and safe");

let threw = false;
try { removeTier("Nobody", "sword"); } catch { threw = true; }
ok(threw, "removing an unknown player throws instead of silently writing");

const removed = removeTier("TestHero", "sword");
ok(removed.removed === 1, "remove reports how many rankings it cleared");
ok(findPlayer("TestHero") === null, "a player left with nothing is dropped entirely");
ok(leaderboard().length === 0, "the leaderboard is empty again");

fs.rmSync(tmp, { force: true });

console.log("\n---");
if (failed) {
  console.log(`FAILED (${failed})`);
  process.exitCode = 1;
} else {
  console.log("ALL TIER COMMAND CHECKS PASSED");
}
