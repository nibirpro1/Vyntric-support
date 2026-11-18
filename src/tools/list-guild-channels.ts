import dotenv from "dotenv";
dotenv.config();
import { Client, GatewayIntentBits, ChannelType } from "discord.js";

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN);
  const guild = await client.guilds.fetch("1507706011622965258");
  const channels = await guild.channels.fetch();

  console.log(`Total channels: ${channels.size}`);
  const list: any[] = [];
  for (const [id, ch] of channels) {
    if (!ch) continue;
    const parentName = ch.parentId ? channels.get(ch.parentId)?.name : "NO_CATEGORY";
    const everyoneOverwrite = ch.permissionOverwrites?.cache.get(guild.roles.everyone.id);
    const isPrivate = everyoneOverwrite?.deny.has("ViewChannel") ?? false;
    list.push({
      id: ch.id,
      name: ch.name,
      type: ChannelType[ch.type],
      category: parentName,
      isPrivate,
      position: ch.position,
    });
  }

  // Sort by category and position
  list.sort((a, b) => (a.category || "").localeCompare(b.category || "") || a.position - b.position);
  for (const item of list) {
    console.log(`[${item.type}] Category: ${item.category} | #${item.name} (${item.id}) | Private: ${item.isPrivate}`);
  }
  await client.destroy();
}
main().catch(console.error);
