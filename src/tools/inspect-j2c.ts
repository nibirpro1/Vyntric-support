import dotenv from "dotenv";
dotenv.config();
import { Client, GatewayIntentBits } from "discord.js";

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN);
  const guild = await client.guilds.fetch("1507706011622965258");
  const cat = await guild.channels.fetch("1572303631246434436");
  console.log("J2C Category:", cat?.name);

  const createVc = await guild.channels.fetch("1572303632622289047");
  console.log("Create VC:", createVc?.name, "type:", createVc?.type);

  const iface = await guild.channels.fetch("1572303634178248946");
  console.log("Interface:", iface?.name, "type:", iface?.type);

  await client.destroy();
}
main().catch(console.error);
