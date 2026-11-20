import { Collection } from "discord.js";
import { executeAutoModCheck } from "../lib/automodEngine";
import { getAutoModConfig } from "../lib/automodStore";

async function testAutoModBypass() {
  console.log("==================================================");
  console.log("   AUTOMOD ROLE WHITELIST & BYPASS TEST SUITE    ");
  console.log("==================================================");

  const guildId = "1507706011622965258";
  const config = getAutoModConfig(guildId);
  console.log("AutoMod Enabled:", config.enabled);
  console.log("Exempt Roles in Store:", config.exemptRoles);

  // Mock regular member (no bypass)
  const regularRoles = new Collection<string, any>();
  regularRoles.set("1552923825753038939", { id: "1552923825753038939", name: "Members" });

  const regularMember: any = {
    id: "user_regular_123",
    guild: { id: guildId, ownerId: "owner_999" },
    permissions: { has: () => false },
    roles: { cache: regularRoles },
  };

  // Mock whitelisted member with 🛡️ AutoMod Bypass (1571258787778535536)
  const whitelistedRoles = new Collection<string, any>();
  whitelistedRoles.set("1552923825753038939", { id: "1552923825753038939", name: "Members" });
  whitelistedRoles.set("1571258787778535536", { id: "1571258787778535536", name: "🛡️ AutoMod Bypass" });

  const whitelistedMember: any = {
    id: "user_whitelisted_456",
    guild: { id: guildId, ownerId: "owner_999" },
    permissions: { has: () => false },
    roles: { cache: whitelistedRoles },
  };

  const testCases = [
    { name: "Profanity / Gali", content: "tor maderchod chudirbhai khanki" },
    { name: "Discord Invite Link", content: "Join here: https://discord.gg/vyntric" },
    { name: "External Suspicious Link", content: "Free nitro here: https://steamcommunity-gift.ru/claim" },
    { name: "Mass Mention (>4 mentions)", content: "<@111> <@222> <@333> <@444> <@555> check this" },
    { name: "Caps Shouting", content: "HELLO EVERYONE PLEASE LISTEN TO ME RIGHT NOW" },
    { name: "Zalgo Glitch Text", content: "T̶̨͔̠͚̖̓̇͛̚e̸̡̜͉̖̓s̶̢̛͔̠͚̖̓̇͛t̸̡̜͉̖̓" },
    { name: "Emoji Spam Flood", content: "😀😃😄😁😆😅🤣😂🙂🙃😉😊" },
  ];

  let passed = 0;
  let total = testCases.length;

  for (const tc of testCases) {
    console.log(`\nTesting rule: ${tc.name}...`);

    // 1. Regular user should be violated (or handled)
    const mockChannel: any = { id: "chan_general", name: "general", isTextBased: () => true };
    const mockMsgRegular: any = {
      guild: { id: guildId, ownerId: "owner_999" },
      channel: mockChannel,
      author: { id: regularMember.id, bot: false, tag: "RegularUser#0001", send: async () => {} },
      member: regularMember,
      content: tc.content,
      mentions: {
        users: tc.name.includes("Mention") ? new Map([["1", {}], ["2", {}], ["3", {}], ["4", {}], ["5", {}]]) : new Map(),
        roles: new Map(),
      },
      delete: async () => {},
      reply: async () => {},
    };

    // 2. Whitelisted user should ALWAYS return false (complete bypass)
    const mockMsgWhitelisted: any = {
      guild: { id: guildId, ownerId: "owner_999" },
      channel: mockChannel,
      author: { id: whitelistedMember.id, bot: false, tag: "WhitelistedUser#0002", send: async () => {} },
      member: whitelistedMember,
      content: tc.content,
      mentions: {
        users: tc.name.includes("Mention") ? new Map([["1", {}], ["2", {}], ["3", {}], ["4", {}], ["5", {}]]) : new Map(),
        roles: new Map(),
      },
      delete: async () => {},
      reply: async () => {},
    };

    const regularViolated = await executeAutoModCheck(mockMsgRegular, false);
    const whitelistedViolated = await executeAutoModCheck(mockMsgWhitelisted, false);

    if (regularViolated === true && whitelistedViolated === false) {
      console.log(`  ✅ PASSED: Regular flagged (violated=true), Whitelisted completely bypassed (violated=false)`);
      passed++;
    } else {
      console.error(
        `  ❌ FAILED: regularViolated=${regularViolated}, whitelistedViolated=${whitelistedViolated}`
      );
    }
  }

  console.log(`\n==================================================`);
  console.log(`RESULT: ${passed}/${total} TESTS PASSED`);
  console.log(`==================================================`);

  if (passed === total) {
    console.log("🎉 ALL AUTOMOD BYPASS & WHITELIST TESTS VERIFIED PERFECTLY!");
  } else {
    process.exit(1);
  }
}

testAutoModBypass().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
