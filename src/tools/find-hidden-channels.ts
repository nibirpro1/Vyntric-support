import dotenv from "dotenv";
dotenv.config();
import { Client, GatewayIntentBits, ChannelType } from "discord.js";

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN);
  const guild = await client.guilds.fetch("1507706011622965258");
  const channels = await guild.channels.fetch();

  console.log("=== CHANNELS HIDDEN FROM @everyone (ViewChannel = DENIED) ===");
  for (const [id, ch] of channels) {
    if (!ch) continue;
    if (ch.type === ChannelType.GuildCategory) continue;

    const chEveryone = ch.permissionOverwrites?.cache.get(guild.roles.everyone.id);
    const parent = ch.parentId ? channels.get(ch.parentId) : null;
    const parentEveryone = parent?.permissionOverwrites?.cache.get(guild.roles.everyone.id);

    // If channel explicitly denies or inherits parent denying ViewChannel (and doesn't explicitly allow it)
    const deniesView = chEveryone?.deny.has("ViewChannel") || (parentEveryone?.deny.has("ViewChannel") && !chEveryone?.allow.has("ViewChannel"));

    if (deniesView) {
      console.log(`\nID: ${ch.id} | Name: #${ch.name} | Type: ${ChannelType[ch.type]} | Category: ${parent?.name || "NONE"}`);
      const rolesWithAccess = ch.permissionOverwrites.cache
        .filter(ow => ow.allow.has("ViewChannel"))
        .map(ow => {
          const role = guild.roles.cache.get(ow.id);
          return role ? `@Role:${role.name}` : `@Member:${ow.id}`;
        });
      console.log(`  Access granted to: ${rolesWithAccess.join(", ") || "None"}`);
    }
  }
  await client.destroy();
}
main().catch(console.error);
