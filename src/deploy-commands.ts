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
    } else {
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), { body: commands });
      console.log("Deployed globally (can take up to 1 hour to appear).");
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();

