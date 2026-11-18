import dotenv from "dotenv";
dotenv.config();
import { Client, GatewayIntentBits, TextChannel } from "discord.js";

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN);
  const guild = await client.guilds.fetch("1507706011622965258");
  const channel = (await guild.channels.fetch("1572303634178248946")) as TextChannel;
  if (!channel) {
    console.log("Channel not found");
    return;
  }

  const messages = await channel.messages.fetch({ limit: 5 });
  console.log(`Fetched ${messages.size} messages in #${channel.name}:`);
  for (const m of messages.values()) {
    console.log(`--- Message by ${m.author.tag} (${m.author.id}) [Bot: ${m.author.bot}] ---`);
    console.log(`Content: ${m.content}`);
    if (m.embeds.length > 0) {
      console.log("Embeds:", JSON.stringify(m.embeds, null, 2));
    }
    if (m.components.length > 0) {
      console.log("Components:", JSON.stringify(m.components, null, 2));
    }
  }

  await client.destroy();
}
main().catch(console.error);
