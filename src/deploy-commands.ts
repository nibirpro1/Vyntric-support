import "dotenv/config";
import { REST, Routes } from "discord.js";
import { collectCommandPayloads } from "./lib/commandPayloads";

const commands = collectCommandPayloads();
const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

(async () => {
  try {
    console.log(`Deploying ${commands.length} Vyntric slash commands...`);

    if (process.env.GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID), {
        body: commands,
      });
      console.log("Deployed to the guild (instant).");

      // Discord displays duplicate entries if commands exist in both guild and global scopes.
      // Purge any stale global commands to ensure each command appears exactly once.
      try {
        const globalCmds = (await rest.get(
          Routes.applicationCommands(process.env.CLIENT_ID!)
        )) as any[];
        if (Array.isArray(globalCmds) && globalCmds.length > 0) {
          console.log(`Found ${globalCmds.length} stale global commands. Purging to prevent duplicates in Discord...`);
          await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), { body: [] });
          console.log("Stale global commands successfully purged.");
        }
      } catch (purgeErr) {
        console.warn("[WARN] Could not check or purge global commands:", purgeErr);
      }
    } else {
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), { body: commands });
      console.log("Deployed globally (can take up to 1 hour to appear).");
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();

