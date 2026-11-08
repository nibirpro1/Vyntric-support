/**
 * Prints the exact OAuth2 invite link for Vyntric Support.
 *
 * Reads CLIENT_ID (and optionally GUILD_ID) from .env, so the URL always
 * carries the right application id and the right permission bitfield.
 *
 * Run with: npm run invite
 */
import "dotenv/config";
import { INVITE_PERMISSIONS, INVITE_SCOPES, buildInviteUrl, invitePermissionsBitfield } from "../lib/invite";

const clientId = process.env.CLIENT_ID?.trim();
const guildId = process.env.GUILD_ID?.trim() || undefined;

console.log("\n=========================================================");
console.log("  Vyntric Support - bot invite");
console.log("=========================================================\n");

if (!clientId) {
  console.error("CLIENT_ID is missing in .env.");
  console.error("");
  console.error("How to get it:");
  console.error("  1. Open https://discord.com/developers/applications");
  console.error("  2. Select your 'Vyntric Support' application");
  console.error("  3. General Information -> copy 'Application ID'");
  console.error("  4. Paste it into .env as CLIENT_ID=<application id>");
  console.error("  5. Run 'npm run invite' again\n");
  process.exit(1);
}

console.log("Permissions requested:");
for (const permission of INVITE_PERMISSIONS) {
  console.log(`  - ${permission.name}`);
}
console.log(`\nScopes: ${INVITE_SCOPES.join(", ")}`);
console.log(`Permission bitfield: ${invitePermissionsBitfield().toString()}`);
if (guildId) console.log(`Server pre-selected: ${guildId}`);

console.log("\nInvite link (open it in your browser, pick the server, Authorize):\n");
console.log(buildInviteUrl({ clientId, guildId }));

console.log("\nBefore inviting, make sure you have:");
console.log("  1. Enabled SERVER MEMBERS INTENT in Developer Portal -> Bot");
console.log("  2. Set the bot avatar to assets/png/vyntric-logo.png");
console.log("  3. Run 'npm run deploy-commands' so /panel, /ticket and /setup exist");
console.log("  4. Moved the bot role above your staff roles in Server Settings -> Roles\n");
