/**
 * Why is my slash command list empty?
 *
 * Compares what this codebase wants to exist against what Discord actually has
 * registered, for both the guild and globally. Run with: npm run doctor:commands
 */
import "dotenv/config";
import { REST, Routes, type APIApplication, type APIApplicationCommand } from "discord.js";
import { collectCommandPayloads } from "../lib/commandPayloads";

const token = process.env.DISCORD_TOKEN?.trim();
const clientId = process.env.CLIENT_ID?.trim();
const guildId = process.env.GUILD_ID?.trim();

if (!token || !clientId) {
  console.error("DISCORD_TOKEN and CLIENT_ID must both be set in .env.");
  process.exit(1);
}

const rest = new REST().setToken(token);

(async () => {
  try {
    const me = (await rest.get(Routes.oauth2CurrentApplication())) as APIApplication;
    console.log(`Bot          : ${me.name} (${me.id})`);
    console.log(`CLIENT_ID    : ${clientId} ${me.id === clientId ? "match" : "MISMATCH"}`);
    console.log(`GUILD_ID     : ${guildId ?? "(not set - commands deploy globally)"}`);

    const wanted = collectCommandPayloads();
    const wantedNames = wanted.map((c) => c.name).sort();
    console.log(`\nThis codebase wants ${wanted.length} commands:`);
    console.log(`  ${wantedNames.join(" ")}`);

    const registered = (await rest.get(
      Routes.applicationGuildCommands(clientId, guildId!)
    )) as APIApplicationCommand[];
    console.log(`\nDiscord has ${registered.length} registered in THIS guild:`);
    console.log(`  ${registered.map((c) => c.name).sort().join(" ") || "(nothing)"}`);

    const have = registered.map((c) => c.name);
    const missing = wantedNames.filter((n) => !have.includes(n));
    const extra = have.filter((n) => !wantedNames.includes(n));

    console.log(`\nMissing from the guild : ${missing.length ? missing.join(" ") : "(none)"}`);
    console.log(`Stale in the guild     : ${extra.length ? extra.join(" ") : "(none)"}`);

    if (missing.length === 0 && registered.length > 0) {
      console.log(
        "\nCommands ARE registered. If they still do not show in the Discord client, the\n" +
          "invite was made without the applications.commands scope. Re-invite using:\n" +
          `  npm run invite\n` +
          "That link already contains scope=bot applications.commands."
      );
    } else if (missing.length > 0) {
      console.log("\nFix with:  npm run deploy-commands");
      console.log("(guild commands appear within a few seconds)");
    } else {
      console.log("\nNothing is registered yet. Run:  npm run deploy-commands");
    }
  } catch (err) {
    const e = err as { status?: number; message?: string; rawData?: unknown };
    console.error(`\nDiscord rejected the request: ${e.status ?? "?"} ${e.message ?? ""}`);
    if (e.status === 401) console.error("The DISCORD_TOKEN is invalid or expired.");
    if (e.status === 404) console.error("Unknown application or guild - check CLIENT_ID / GUILD_ID.");
  }
  process.exit(0);
})();