import dotenv from "dotenv";
dotenv.config();
import { Client, GatewayIntentBits, ChannelType } from "discord.js";

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN);
  const guild = await client.guilds.fetch("1507706011622965258");
  const channels = await guild.channels.fetch();

  const publicText: any[] = [];
  const privateText: any[] = [];
  const publicVoice: any[] = [];
  const privateVoice: any[] = [];

  for (const [id, ch] of channels) {
    if (!ch || ch.type === ChannelType.GuildCategory) continue;

    const parent = ch.parentId ? channels.get(ch.parentId) : null;
    const chEveryone = ch.permissionOverwrites?.cache.get(guild.roles.everyone.id);
    const parentEveryone = parent?.permissionOverwrites?.cache.get(guild.roles.everyone.id);

    const isPrivate = chEveryone?.deny.has("ViewChannel") || (parentEveryone?.deny.has("ViewChannel") && !chEveryone?.allow.has("ViewChannel"));

    const item = {
      id: ch.id,
      name: ch.name,
      category: parent?.name || "NONE",
      type: ChannelType[ch.type],
    };

    if (ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildNews || ch.type === ChannelType.GuildForum) {
      if (isPrivate) privateText.push(item);
      else publicText.push(item);
    } else if (ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice) {
      if (isPrivate) privateVoice.push(item);
      else publicVoice.push(item);
    }
  }

  console.log("=== PUBLIC TEXT CHANNELS ===");
  publicText.forEach(c => console.log(`  [${c.category}] #${c.name} (${c.id})`));

  console.log("\n=== PRIVATE TEXT CHANNELS ===");
  privateText.forEach(c => console.log(`  [${c.category}] #${c.name} (${c.id})`));

  console.log("\n=== PUBLIC VOICE CHANNELS ===");
  publicVoice.forEach(c => console.log(`  [${c.category}] 🔊 ${c.name} (${c.id})`));

  console.log("\n=== PRIVATE VOICE CHANNELS ===");
  privateVoice.forEach(c => console.log(`  [${c.category}] 🔒🔊 ${c.name} (${c.id})`));

  await client.destroy();
}
main().catch(console.error);
