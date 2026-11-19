import assert from "assert";
import {
  deleteGiveaway,
  getGiveaway,
  Giveaway,
  saveGiveaway,
} from "../lib/giveawayStore";
import { endGiveaway } from "../lib/giveawayManager";

async function runTests() {
  console.log("=== Running Duplicate Ping Prevention Verification ===");

  const guildId = "1507706011622965258";
  const channelId = "1552331192546623598";
  const testMsgId1 = "999111222333444555";
  const testMsgId2 = "999111222333444556";
  const testMsgId3 = "999111222333444557";

  deleteGiveaway(testMsgId1);
  deleteGiveaway(testMsgId2);
  deleteGiveaway(testMsgId3);

  // TEST 1: If original message was deleted in Discord (404/10008), endGiveaway must mark ended=true and NOT announce
  console.log("[Test 1] Testing deleted message in Discord...");
  const deletedGw: Giveaway = {
    id: testMsgId1,
    guildId,
    channelId,
    messageId: testMsgId1,
    prize: "Deleted Message Test Prize",
    winnersCount: 1,
    hostId: "123456789012345678",
    requiredRoleId: null,
    secretWinnerIds: [],
    entries: ["111111111111111111", "222222222222222222"],
    startTime: Date.now() - 3600000,
    endTime: Date.now() - 1000,
    ended: false,
    winnerIds: [],
  };
  saveGiveaway(deletedGw);

  let announcedSent1 = false;
  const mockClientDeleted: any = {
    user: { id: "bot12345" },
    channels: {
      cache: { get: () => null },
      fetch: async () => ({
        name: "giveaways",
        messages: {
          fetch: async (id: any) => {
            const err: any = new Error("Unknown Message");
            err.code = 10008;
            throw err;
          },
        },
        send: async () => {
          announcedSent1 = true;
        },
      }),
    },
    users: { fetch: async () => null },
  };

  const res1 = await endGiveaway(testMsgId1, mockClientDeleted);
  assert.strictEqual(announcedSent1, false, "Should NOT send announcement if message is deleted!");
  const stored1 = getGiveaway(testMsgId1);
  assert.strictEqual(stored1?.ended, true, "Should mark giveaway as ended=true!");
  console.log("✅ [Test 1 Passed] Deleted message marked as ended with zero spam.");

  // TEST 2: If message embed is already ended on Discord, endGiveaway must sync and NOT announce
  console.log("[Test 2] Testing already-ended Discord embed...");
  const alreadyEndedGw: Giveaway = {
    id: testMsgId2,
    guildId,
    channelId,
    messageId: testMsgId2,
    prize: "Already Ended Test Prize",
    winnersCount: 1,
    hostId: "123456789012345678",
    requiredRoleId: null,
    secretWinnerIds: [],
    entries: ["111111111111111111", "222222222222222222"],
    startTime: Date.now() - 3600000,
    endTime: Date.now() - 1000,
    ended: false, // in store it was false (e.g. from git repo reset)
    winnerIds: [],
  };
  saveGiveaway(alreadyEndedGw);

  let announcedSent2 = false;
  const mockClientAlreadyEnded: any = {
    user: { id: "bot12345" },
    channels: {
      cache: { get: () => null },
      fetch: async () => ({
        name: "giveaways",
        messages: {
          fetch: async (id: any) => ({
            id: testMsgId2,
            embeds: [
              {
                author: { name: "🎉 Giveaway Ended 🎉" },
                title: "🎁 Already Ended Test Prize 🎁",
                description: "🏆 **Winner(s):** <@111111111111111111>",
                footer: { text: "Giveaway Ended" },
              },
            ],
          }),
        },
        send: async () => {
          announcedSent2 = true;
        },
      }),
    },
    users: { fetch: async () => null },
  };

  const res2 = await endGiveaway(testMsgId2, mockClientAlreadyEnded);
  assert.strictEqual(announcedSent2, false, "Should NOT send announcement if embed is already ended!");
  const stored2 = getGiveaway(testMsgId2);
  assert.strictEqual(stored2?.ended, true, "Should sync ended=true!");
  assert.deepStrictEqual(stored2?.winnerIds, ["111111111111111111"], "Should restore winner IDs from embed!");
  console.log("✅ [Test 2 Passed] Embed ended status correctly detected and synced without ping.");

  // TEST 3: If channel has existing winner announcement message, endGiveaway must abort without ping
  console.log("[Test 3] Testing existing channel announcement...");
  const unendedGw: Giveaway = {
    id: testMsgId3,
    guildId,
    channelId,
    messageId: testMsgId3,
    prize: "Minecraft Full Access",
    winnersCount: 1,
    hostId: "123456789012345678",
    requiredRoleId: null,
    secretWinnerIds: [],
    entries: ["111111111111111111", "222222222222222222"],
    startTime: Date.now() - 3600000,
    endTime: Date.now() - 1000,
    ended: false,
    winnerIds: [],
  };
  saveGiveaway(unendedGw);

  let announcedSent3 = false;
  const mockClientExistingAnnounce: any = {
    user: { id: "bot12345" },
    channels: {
      cache: { get: () => null },
      fetch: async () => ({
        name: "giveaways",
        messages: {
          fetch: async (opt: any) => {
            if (typeof opt === "string") {
              // Giveaway message itself
              return {
                id: testMsgId3,
                embeds: [{ title: "🎁 Minecraft Full Access 🎁", description: "Winners: `1`" }],
              };
            }
            // Recent channel messages
            return [
              {
                id: "announce1",
                author: { id: "bot12345" },
                content: "🎉 Congratulations <@111111111111111111>! You won **Minecraft Full Access**!\n-# Hosted by <@123456789012345678>",
              },
            ];
          },
        },
        send: async () => {
          announcedSent3 = true;
        },
      }),
    },
    users: { fetch: async () => null },
  };

  const res3 = await endGiveaway(testMsgId3, mockClientExistingAnnounce);
  assert.strictEqual(announcedSent3, false, "Should NOT send announcement if announcement already exists in channel!");
  const stored3 = getGiveaway(testMsgId3);
  assert.strictEqual(stored3?.ended, true, "Should mark giveaway as ended=true!");
  console.log("✅ [Test 3 Passed] Existing channel announcement prevented duplicate ping.");

  // Clean up test giveaways
  deleteGiveaway(testMsgId1);
  deleteGiveaway(testMsgId2);
  deleteGiveaway(testMsgId3);

  console.log("\n🎉 ALL DUPLICATE PING PREVENTION TESTS PASSED WITH 100% SUCCESS!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
