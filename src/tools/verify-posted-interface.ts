import dotenv from "dotenv";
dotenv.config();
import { Client, GatewayIntentBits, TextChannel } from "discord.js";

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN);
  const ch = (await client.channels.fetch("1572303634178248946")) as TextChannel;
  const msg = await ch.messages.fetch("1572522616550330420");
  console.log("Author:", msg.author.tag, "[Bot:", msg.author.bot, "]");
  console.log("Embed title/description:", msg.embeds[0]?.description);
  console.log("Embed image:", msg.embeds[0]?.image?.url);
  console.log("ActionRows count:", msg.components.length);
  for (let i = 0; i < msg.components.length; i++) {
    const row: any = msg.components[i];
    console.log(`Row ${i + 1} buttons:`, row.components.map((c: any) => `${c.customId} (${c.emoji?.name})`).join(", "));
  }
  await client.destroy();
}
main().catch(console.error);
