import dotenv from "dotenv";
dotenv.config();
import { Client, GatewayIntentBits } from "discord.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on("ready", async () => {
  const guild = await client.guilds.fetch("1507706011622965258");
  await guild.roles.fetch();
  const sorted = Array.from(guild.roles.cache.values()).sort((a, b) => b.position - a.position);
  console.log("=== ALL CURRENT ROLES ===");
  for (const r of sorted) {
    console.log(`- "${r.name}" (${r.id}) [color: #${r.color.toString(16)}]`);
  }
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
