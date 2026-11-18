import dotenv from "dotenv";
dotenv.config();
import { Client, GatewayIntentBits, TextChannel } from "discord.js";

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN);
  const ch = (await client.channels.fetch("1572303634178248946")) as TextChannel;
  const msgs = await ch.messages.fetch({ limit: 10 });
  console.log(`Total messages in #interface: ${msgs.size}`);
  for (const m of msgs.values()) {
    console.log(`- Message ID ${m.id} by ${m.author.tag} (${m.author.id})`);
    if (m.author.id !== client.user?.id) {
      console.log("  Deleting old bot message from TempVoice...");
      await m.delete().catch(() => {});
    }
  }
  await client.destroy();
}
main().catch(console.error);
