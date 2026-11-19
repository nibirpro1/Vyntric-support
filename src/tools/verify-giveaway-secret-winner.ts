import assert from "assert";
import {
  Giveaway,
  saveGiveaway,
  getGiveaway,
  deleteGiveaway,
  setSecretWinner,
  clearSecretWinners,
  resolveGiveaway,
  addGiveawayEntry,
} from "../lib/giveawayStore";
import { endGiveaway, rerollGiveaway } from "../lib/giveawayManager";

async function runTests() {
  console.log("=== Running Giveaway Secret Winner Verification Suite ===");

  const testMessageId = "999888777666555444";
  const guildId = "1507706011622965258";
  const secretUser1 = "111111111111111111";
  const secretUser2 = "222222222222222222";
  const normalUser1 = "333333333333333333";
  const normalUser2 = "444444444444444444";

  // Mock client for endGiveaway/rerollGiveaway
  const mockClient: any = {
    channels: {
      cache: {
        get: () => null,
      },
      fetch: async () => null,
    },
    users: {
      fetch: async () => null,
    },
  };

  // Clean up any existing record
  deleteGiveaway(testMessageId);

  // ─────────────────────────────────────────────────────────────
  // TEST 1: resolveGiveaway with Discord URLs, snowflakes, and prize names
  // ─────────────────────────────────────────────────────────────
  console.log("[Test 1] Testing resolveGiveaway...");
  const dummyGiveaway: Giveaway = {
    id: testMessageId,
    guildId,
    channelId: "1552331192546623598",
    messageId: testMessageId,
    prize: "Mega Secret Diamond Pass",
    winnersCount: 1,
    hostId: "999000111222333444",
    requiredRoleId: null,
    secretWinnerIds: [],
    entries: [],
    startTime: Date.now(),
    endTime: Date.now() + 60000,
    ended: false,
    winnerIds: [],
  };
  saveGiveaway(dummyGiveaway);

  // Test url resolution
  const fromUrl = resolveGiveaway(
    `https://discord.com/channels/${guildId}/1552331192546623598/${testMessageId}`,
    guildId
  );
  assert(fromUrl && fromUrl.messageId === testMessageId, "Failed to resolve from Discord URL");

  // Test direct snowflake
  const fromId = resolveGiveaway(testMessageId, guildId);
  assert(fromId && fromId.messageId === testMessageId, "Failed to resolve from snowflake");

  // Test exact prize name
  const fromExactPrize = resolveGiveaway("Mega Secret Diamond Pass", guildId);
  assert(fromExactPrize && fromExactPrize.messageId === testMessageId, "Failed to resolve from exact prize");

  // Test partial prize name
  const fromPartialPrize = resolveGiveaway("diamond pass", guildId);
  assert(fromPartialPrize && fromPartialPrize.messageId === testMessageId, "Failed to resolve from partial prize");

  console.log("✅ [Test 1 Passed] resolveGiveaway handles URLs, IDs, and prize names perfectly.");

  // ─────────────────────────────────────────────────────────────
  // TEST 2: setSecretWinner does NOT leak into entries
  // ─────────────────────────────────────────────────────────────
  console.log("[Test 2] Testing secret winner setting & zero-leak entries...");
  const setOk = setSecretWinner(testMessageId, secretUser1);
  assert(setOk, "setSecretWinner failed");

  const gAfterSet = getGiveaway(testMessageId)!;
  assert(gAfterSet.secretWinnerIds.includes(secretUser1), "secretWinnerIds missing secret user");
  assert(!gAfterSet.entries.includes(secretUser1), "CRITICAL: Secret winner was leaked into entries!");
  assert.strictEqual(gAfterSet.entries.length, 0, "Entries count should remain 0 before any clicks");
  console.log("✅ [Test 2 Passed] Secret winner set without leaking into public entries.");

  // ─────────────────────────────────────────────────────────────
  // TEST 3: Natural entry flow for both normal users and secret winner
  // ─────────────────────────────────────────────────────────────
  console.log("[Test 3] Testing natural button entry flow...");
  // Normal users enter
  const resNorm1 = addGiveawayEntry(testMessageId, normalUser1);
  assert(resNorm1 && !resNorm1.alreadyEntered && resNorm1.entriesCount === 1, "Normal entry 1 failed");

  const resNorm2 = addGiveawayEntry(testMessageId, normalUser2);
  assert(resNorm2 && !resNorm2.alreadyEntered && resNorm2.entriesCount === 2, "Normal entry 2 failed");

  // Secret winner enters: should NOT get "alreadyEntered: true"
  const resSec = addGiveawayEntry(testMessageId, secretUser1);
  assert(resSec && !resSec.alreadyEntered && resSec.entriesCount === 3, "Secret winner entry failed");

  // Duplicate click should be prevented
  const resDup = addGiveawayEntry(testMessageId, secretUser1);
  assert(resDup && resDup.alreadyEntered, "Duplicate entry was not prevented");
  console.log("✅ [Test 3 Passed] Natural entry flow confirmed.");

  // ─────────────────────────────────────────────────────────────
  // TEST 4: endGiveaway guarantees secret winner wins 100%
  // ─────────────────────────────────────────────────────────────
  console.log("[Test 4] Testing endGiveaway secret winner outcome...");
  const endRes = await endGiveaway(testMessageId, mockClient, undefined, false);
  assert(endRes.success, "endGiveaway failed");
  assert(endRes.winners.includes(secretUser1), `Expected secret winner ${secretUser1} to win, got: ${endRes.winners}`);
  assert.strictEqual(endRes.winners.length, 1, "Only 1 winner should be selected");
  console.log("✅ [Test 4 Passed] Secret winner won the giveaway 100% guaranteed.");

  // ─────────────────────────────────────────────────────────────
  // TEST 5: Secret winner who never entered still wins 100%
  // ─────────────────────────────────────────────────────────────
  console.log("[Test 5] Testing secret winner who never clicked enter...");
  const testMessageId2 = "999888777666555445";
  const dummyGiveaway2: Giveaway = {
    id: testMessageId2,
    guildId,
    channelId: "1552331192546623598",
    messageId: testMessageId2,
    prize: "Unentered Secret Giveaway",
    winnersCount: 1,
    hostId: "999000111222333444",
    requiredRoleId: null,
    secretWinnerIds: [secretUser2],
    entries: [normalUser1, normalUser2], // secretUser2 never clicked enter
    startTime: Date.now(),
    endTime: Date.now() + 60000,
    ended: false,
    winnerIds: [],
  };
  saveGiveaway(dummyGiveaway2);

  const endRes2 = await endGiveaway(testMessageId2, mockClient, undefined, false);
  assert(endRes2.success, "endGiveaway 2 failed");
  assert(endRes2.winners.includes(secretUser2), `Expected unentered secret winner ${secretUser2} to win`);
  const g2Final = getGiveaway(testMessageId2)!;
  assert(g2Final.entries.includes(secretUser2), "Unentered secret winner should be cleanly appended to entries at end");
  console.log("✅ [Test 5 Passed] Unentered secret winner successfully selected and appended.");

  // ─────────────────────────────────────────────────────────────
  // TEST 6: Multi-winner giveaway (secret winner + random winners)
  // ─────────────────────────────────────────────────────────────
  console.log("[Test 6] Testing multi-winner giveaway (1 secret + 1 random)...");
  const testMessageId3 = "999888777666555446";
  const dummyGiveaway3: Giveaway = {
    id: testMessageId3,
    guildId,
    channelId: "1552331192546623598",
    messageId: testMessageId3,
    prize: "Multi Winner Pass",
    winnersCount: 2,
    hostId: "999000111222333444",
    requiredRoleId: null,
    secretWinnerIds: [secretUser1],
    entries: [normalUser1, normalUser2],
    startTime: Date.now(),
    endTime: Date.now() + 60000,
    ended: false,
    winnerIds: [],
  };
  saveGiveaway(dummyGiveaway3);

  const endRes3 = await endGiveaway(testMessageId3, mockClient, undefined, false);
  assert(endRes3.success, "endGiveaway 3 failed");
  assert(endRes3.winners.length === 2, "Expected 2 winners");
  assert(endRes3.winners.includes(secretUser1), "Secret winner must be among the 2 winners");
  console.log("✅ [Test 6 Passed] Multi-winner slot filled with secret winner + random entry.");

  // ─────────────────────────────────────────────────────────────
  // TEST 7: Reroll with pre-set secret winner
  // ─────────────────────────────────────────────────────────────
  console.log("[Test 7] Testing reroll with pre-configured secret winner...");
  const testMessageId4 = "999888777666555447";
  const dummyGiveaway4: Giveaway = {
    id: testMessageId4,
    guildId,
    channelId: "1552331192546623598",
    messageId: testMessageId4,
    prize: "Reroll Secret Pass",
    winnersCount: 1,
    hostId: "999000111222333444",
    requiredRoleId: null,
    secretWinnerIds: [secretUser1, secretUser2], // secretUser2 is the backup reroll secret
    entries: [normalUser1, normalUser2],
    startTime: Date.now() - 100000,
    endTime: Date.now() - 50000,
    ended: true,
    winnerIds: [secretUser1], // secretUser1 already won
  };
  saveGiveaway(dummyGiveaway4);

  const rerollRes = await rerollGiveaway(testMessageId4, mockClient);
  assert(rerollRes.success, "rerollGiveaway failed");
  assert.strictEqual(rerollRes.newWinner, secretUser2, `Expected unused secret ${secretUser2} to win reroll, got: ${rerollRes.newWinner}`);
  console.log("✅ [Test 7 Passed] Reroll selected unused secret winner.");

  // Cleanup test records
  deleteGiveaway(testMessageId);
  deleteGiveaway(testMessageId2);
  deleteGiveaway(testMessageId3);
  deleteGiveaway(testMessageId4);

  console.log("\n🎉 ALL 7 GIVEAWAY SECRET WINNER TESTS PASSED WITH 100% SUCCESS!");
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
