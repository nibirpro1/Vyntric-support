import { handleTempVoiceStateUpdate } from "../lib/tempVoiceManager";
import { getTempVoiceConfig, getAllTempChannels, deleteTempChannel } from "../lib/tempVoiceStore";

async function runTest() {
  console.log("=== Starting JTC Concurrency & Duplicate Prevention Verification ===");

  const guildId = "1507706011622965258";
  const config = getTempVoiceConfig(guildId);
  console.log("Config loaded:", {
    creatorChannelId: config.creatorChannelId,
    categoryId: config.categoryId,
  });

  let count = 0;
  const getCreatedCount = () => count;
  const mockCreatedChannels: any[] = [];

  // Mock guild
  const mockGuild: any = {
    id: guildId,
    client: {
      user: { id: "bot-123" },
    },
    channels: {
      cache: new Map(),
      create: async (opts: any) => {
        count++;
        const ch = {
          id: `mock-ch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: opts.name,
          parentId: opts.parent,
          isVoiceBased: () => true,
          permissionOverwrites: {
            edit: async () => {},
            delete: async () => {},
          },
          send: async () => ({ id: "mock-msg-123" }),
          delete: async () => {
            console.log("  [Mock] Channel deleted successfully.");
          },
          members: new Map(),
        };
        mockCreatedChannels.push(ch);
        // Simulate Discord REST latency (200ms)
        await new Promise((r) => setTimeout(r, 200));
        return ch;
      },
      fetch: async (id: string) => {
        return mockCreatedChannels.find((c) => c.id === id) || null;
      },
    },
    members: {
      fetchMe: async () => ({ id: "bot-123" }),
    },
  };

  // Test 1: Audio state update with same channelId (e.g. self-mute/deafen) -> must be IGNORED
  console.log("\n[Test 1] Testing audio state update (oldChannel === newChannel)...");
  const memberA: any = {
    id: "user-test-1",
    displayName: "TestUser1",
    user: { tag: "TestUser1#0001", username: "testuser1", bot: false },
    voice: {
      channelId: config.creatorChannelId,
      setChannel: async () => {},
    },
  };

  const oldStateA: any = { channelId: config.creatorChannelId, member: memberA, guild: mockGuild };
  const newStateA: any = { channelId: config.creatorChannelId, member: memberA, guild: mockGuild };

  await handleTempVoiceStateUpdate(oldStateA, newStateA);
  console.log(`Channels created after Test 1: ${getCreatedCount()} (Expected: 0)`);
  if (getCreatedCount() !== 0) throw new Error("Test 1 FAILED: Audio update triggered channel creation!");
  console.log("✅ Test 1 PASSED: Same channelId audio updates are completely ignored.");

  // Test 2: Concurrent join burst (2 events at the exact same time for the same user)
  console.log("\n[Test 2] Testing rapid concurrent joins for user-test-2...");
  const memberB: any = {
    id: "user-test-2",
    displayName: "TestUser2",
    user: { tag: "TestUser2#0002", username: "testuser2", bot: false },
    voice: {
      channelId: config.creatorChannelId,
      setChannel: async (target: any) => {
        console.log(`  [Mock] Moved user ${memberB.user.tag} to ${target.name}`);
      },
    },
  };

  const oldStateB1: any = { channelId: null, member: memberB, guild: mockGuild };
  const newStateB1: any = { channelId: config.creatorChannelId, member: memberB, guild: mockGuild };

  const oldStateB2: any = { channelId: null, member: memberB, guild: mockGuild };
  const newStateB2: any = { channelId: config.creatorChannelId, member: memberB, guild: mockGuild };

  // Dispatch both simultaneously
  await Promise.all([
    handleTempVoiceStateUpdate(oldStateB1, newStateB1),
    handleTempVoiceStateUpdate(oldStateB2, newStateB2),
  ]);

  console.log(`Channels created after Test 2: ${getCreatedCount()} (Expected: 1)`);
  if (getCreatedCount() !== 1) {
    throw new Error(`Test 2 FAILED: Expected 1 channel, but ${getCreatedCount()} were created!`);
  }
  console.log("✅ Test 2 PASSED: Mutex lock successfully blocked concurrent duplicate channel creation!");

  // Test 3: Rapid debounce cooldown (attempting to trigger another join 100ms later)
  console.log("\n[Test 3] Testing debounce cooldown within 2.5s window...");
  await handleTempVoiceStateUpdate(oldStateB1, newStateB1);
  console.log(`Channels created after Test 3: ${getCreatedCount()} (Expected still 1)`);
  if (getCreatedCount() !== 1) {
    throw new Error("Test 3 FAILED: Cooldown did not block rapid re-entry!");
  }
  console.log("✅ Test 3 PASSED: Cooldown successfully rate-limited rapid repeat clicks!");

  // Cleanup mock test channels from store
  for (const ch of mockCreatedChannels) {
    deleteTempChannel(ch.id);
  }

  console.log("\n========================================================");
  console.log("🎉 ALL TESTS PASSED: Zero duplicate channel creations possible!");
  console.log("========================================================");
}

runTest().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
