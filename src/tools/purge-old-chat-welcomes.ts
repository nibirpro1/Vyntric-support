import dotenv from "dotenv";
dotenv.config();
import { Client, GatewayIntentBits, TextChannel } from "discord.js";

async function main() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  });
  await client.login(process.env.DISCORD_TOKEN);

  const ch = (await client.channels.fetch("1560688449353420930")) as TextChannel;
  const messages = await ch.messages.fetch({ limit: 50 });
  let count = 0;

  for (const [id, msg] of messages) {
    const isBot = msg.author.id === client.user?.id;
    const isWelcome =
      msg.content.includes("Welcome to the chat") ||
      msg.embeds.some((e) => e.title?.includes("Welcome to Vyntric"));

    if (isBot && isWelcome) {
      console.log(`[Purge] Deleting old welcome message ${id} from ${msg.createdAt.toISOString()}`);
      await msg.delete().catch(() => {});
      count++;
    }
  }

  console.log(`[Done] Successfully purged ${count} duplicate/old welcome message(s) from #${ch.name}!`);
  process.exit(0);
}

main().catch(console.error);
