import dotenv from "dotenv";
dotenv.config();
import { Client, GatewayIntentBits } from "discord.js";

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN);
  const guild = await client.guilds.fetch("1507706011622965258");
  await guild.roles.fetch();

  console.log("=== ALL GUILD ROLES ===");
  const sorted = Array.from(guild.roles.cache.values()).sort((a, b) => b.position - a.position);
  for (const r of sorted) {
    console.log(`[Pos ${r.position}] ${r.name} (${r.id}) - Color: #${r.color.toString(16)} - Members: ${r.members.size}`);
  }

  await client.destroy();
}
main().catch(console.error);
