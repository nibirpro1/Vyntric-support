import dotenv from "dotenv";
dotenv.config();
import { Client, GatewayIntentBits, ChannelType } from "discord.js";

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN);
  const guild = await client.guilds.fetch("1507706011622965258");
  const channels = await guild.channels.fetch();

  console.log("=== ALL PRIVATE TEXT CHANNELS ===");
  for (const [id, ch] of channels) {
    if (!ch) continue;
    if (ch.type !== ChannelType.GuildText && ch.type !== ChannelType.GuildNews) continue;
    
    // Check if channel is private (either directly or via parent)
    const chEveryone = ch.permissionOverwrites?.cache.get(guild.roles.everyone.id);
    const parent = ch.parentId ? channels.get(ch.parentId) : null;
    const parentEveryone = parent?.permissionOverwrites?.cache.get(guild.roles.everyone.id);

    const isPrivate = chEveryone?.deny.has("ViewChannel") || parentEveryone?.deny.has("ViewChannel");

    if (isPrivate) {
      console.log(`\nChannel: #${ch.name} (${ch.id}) | Parent: ${parent?.name || "NONE"}`);
      console.log("  Overwrites:");
      for (const [targetId, ow] of ch.permissionOverwrites.cache) {
        const role = guild.roles.cache.get(targetId);
        const name = role ? `@Role:${role.name}` : `@Member/Target:${targetId}`;
        console.log(`    - ${name} (${targetId}): ALLOW=[${ow.allow.toArray().join(", ")}] DENY=[${ow.deny.toArray().join(", ")}]`);
      }
    }
  }
  await client.destroy();
}
main().catch(console.error);
