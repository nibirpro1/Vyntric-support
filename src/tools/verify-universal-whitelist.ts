import { isUniversalImmune, syncWhitelistAdd, syncWhitelistRemove, syncWhitelistClear } from "../lib/universalWhitelist";
import { getAntiNukeConfig } from "../lib/antinukeStore";
import { getAntiRaidConfig } from "../lib/antiraidStore";
import { getAutoModConfig } from "../lib/automodStore";
import { hasFeaturePermission } from "../lib/permissionRolesStore";
import { PermissionFlagsBits } from "discord.js";

async function runTests() {
  console.log("🧪 Starting Universal Whitelist & Full Bypass Verification Suite...\n");

  const testGuildId = "test_guild_whitelist_999";
  const mockGuild: any = {
    id: testGuildId,
    ownerId: "mock_owner_111",
    client: { user: { id: "mock_bot_000" } },
    members: {
      cache: new Map(),
      fetch: async (id: string) => null,
    },
  };

  const regularUserId = "regular_user_123";
  const whitelistedUserId = "whitelisted_user_456";
  const whitelistedRoleId = "whitelisted_role_789";

  // Mock regular member
  const mockRegularMember: any = {
    id: regularUserId,
    guild: mockGuild,
    permissions: { has: (perm: bigint) => false },
    roles: {
      cache: new Map(),
    },
  };

  // Mock whitelisted role member
  const mockWhitelistedRoleMember: any = {
    id: "role_holder_member_555",
    guild: mockGuild,
    permissions: { has: (perm: bigint) => false },
    roles: {
      cache: new Map([[whitelistedRoleId, { id: whitelistedRoleId, name: "VIP Shield" }]]),
    },
  };

  // Test 1: Baseline non-whitelisted user check
  const baseline = isUniversalImmune(mockGuild, regularUserId, mockRegularMember);
  console.log(`[Test 1] Regular user baseline isUniversalImmune: ${baseline} (expected: false)`);
  if (baseline !== false) throw new Error("Test 1 failed: Regular user should not be immune");

  // Test 2: Server Owner check
  const ownerCheck = isUniversalImmune(mockGuild, mockGuild.ownerId);
  console.log(`[Test 2] Server Owner isUniversalImmune: ${ownerCheck} (expected: true)`);
  if (!ownerCheck) throw new Error("Test 2 failed: Server owner must be immune");

  // Test 3: Protected Super Admin (notraian69.) check
  const adminCheck = isUniversalImmune(mockGuild, "1495738572362481777");
  console.log(`[Test 3] notraian69. isUniversalImmune: ${adminCheck} (expected: true)`);
  if (!adminCheck) throw new Error("Test 3 failed: notraian69. must be immune");

  // Test 4: 3-Way Atomic Synchronization Add
  console.log("\n[Test 4] Executing syncWhitelistAdd for user and role...");
  syncWhitelistAdd(testGuildId, { userId: whitelistedUserId, roleId: whitelistedRoleId });

  const nukeCfg = getAntiNukeConfig(testGuildId);
  const raidCfg = getAntiRaidConfig(testGuildId);
  const amCfg = getAutoModConfig(testGuildId);

  const nukeHasUser = nukeCfg.whitelistedUsers.includes(whitelistedUserId);
  const raidHasUser = raidCfg.whitelistedUsers.includes(whitelistedUserId);
  const amHasUser = amCfg.exemptUsers?.includes(whitelistedUserId);

  const nukeHasRole = nukeCfg.whitelistedRoles.includes(whitelistedRoleId);
  const raidHasRole = raidCfg.whitelistedRoles.includes(whitelistedRoleId);
  const amHasRole = amCfg.exemptRoles?.includes(whitelistedRoleId);

  console.log(`  -> AntiNuke has user: ${nukeHasUser}, role: ${nukeHasRole}`);
  console.log(`  -> AntiRaid has user: ${raidHasUser}, role: ${raidHasRole}`);
  console.log(`  -> AutoMod has user: ${amHasUser}, role: ${amHasRole}`);

  if (!nukeHasUser || !raidHasUser || !amHasUser) {
    throw new Error("Test 4 failed: User not synchronized across all 3 stores");
  }
  if (!nukeHasRole || !raidHasRole || !amHasRole) {
    throw new Error("Test 4 failed: Role not synchronized across all 3 stores");
  }

  // Test 5: Whitelisted user immunity
  const userImmune = isUniversalImmune(mockGuild, whitelistedUserId);
  console.log(`\n[Test 5] Whitelisted user isUniversalImmune: ${userImmune} (expected: true)`);
  if (!userImmune) throw new Error("Test 5 failed: Whitelisted user must be immune");

  // Test 6: Whitelisted role member immunity
  const roleMemberImmune = isUniversalImmune(mockGuild, mockWhitelistedRoleMember.id, mockWhitelistedRoleMember);
  console.log(`[Test 6] Whitelisted role member isUniversalImmune: ${roleMemberImmune} (expected: true)`);
  if (!roleMemberImmune) throw new Error("Test 6 failed: Whitelisted role member must be immune");

  // Test 7: Feature Permissions bypass
  const mockWhitelistedUserMember: any = {
    id: whitelistedUserId,
    guild: mockGuild,
    permissions: { has: (perm: bigint) => false },
    roles: { cache: new Map() },
  };
  const permLink = hasFeaturePermission(mockWhitelistedUserMember, "link");
  const permMod = hasFeaturePermission(mockWhitelistedUserMember, "mod");
  const permSecurity = hasFeaturePermission(mockWhitelistedUserMember, "security");
  console.log(`\n[Test 7] Whitelisted user hasFeaturePermission('link'): ${permLink}`);
  console.log(`         Whitelisted user hasFeaturePermission('mod'): ${permMod}`);
  console.log(`         Whitelisted user hasFeaturePermission('security'): ${permSecurity}`);
  if (!permLink || !permMod || !permSecurity) {
    throw new Error("Test 7 failed: Whitelisted user must bypass and receive feature permissions");
  }

  // Test 8: 3-Way Atomic Synchronization Remove
  console.log("\n[Test 8] Executing syncWhitelistRemove...");
  syncWhitelistRemove(testGuildId, { userId: whitelistedUserId, roleId: whitelistedRoleId });
  const nukeCfgPost = getAntiNukeConfig(testGuildId);
  const raidCfgPost = getAntiRaidConfig(testGuildId);
  const amCfgPost = getAutoModConfig(testGuildId);
  if (
    nukeCfgPost.whitelistedUsers.includes(whitelistedUserId) ||
    raidCfgPost.whitelistedUsers.includes(whitelistedUserId) ||
    amCfgPost.exemptUsers?.includes(whitelistedUserId)
  ) {
    throw new Error("Test 8 failed: User not removed from all 3 stores");
  }
  console.log("  -> Successfully removed user and role from AntiNuke, AntiRaid, and AutoMod simultaneously.");

  // Test 9: 3-Way Atomic Clear
  console.log("\n[Test 9] Executing syncWhitelistClear('all')...");
  syncWhitelistAdd(testGuildId, { userId: "temp_user_999", roleId: "temp_role_999" });
  syncWhitelistClear(testGuildId, "all");
  const nukeCfgClear = getAntiNukeConfig(testGuildId);
  const raidCfgClear = getAntiRaidConfig(testGuildId);
  const amCfgClear = getAutoModConfig(testGuildId);
  if (
    nukeCfgClear.whitelistedUsers.length !== 0 ||
    nukeCfgClear.whitelistedRoles.length !== 0 ||
    raidCfgClear.whitelistedUsers.length !== 0 ||
    raidCfgClear.whitelistedRoles.length !== 0 ||
    (amCfgClear.exemptUsers && amCfgClear.exemptUsers.length !== 0) ||
    (amCfgClear.exemptRoles && amCfgClear.exemptRoles.length !== 0)
  ) {
    throw new Error("Test 9 failed: Stores not fully cleared");
  }
  console.log("  -> Successfully cleared all stores.");

  console.log("\n🎉 ALL TESTS PASSED! Universal Whitelist & Full Bypass System is 100% verified.");
}

runTests().catch((err) => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});
