import dotenv from "dotenv";
dotenv.config();
import { Client, GatewayIntentBits } from "discord.js";

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN);
  const guild = await client.guilds.fetch("1507706011622965258");
  const channels = await guild.channels.fetch();

  const privateChannels: any[] = [];
  for (const [id, ch] of channels) {
    if (!ch || ch.type === 4) continue; // skip categories

    const everyoneOW = ch.permissionOverwrites?.cache.get(guild.roles.everyone.id);
    const parent = ch.parentId ? channels.get(ch.parentId) : null;
    const parentEveryoneOW = parent?.permissionOverwrites?.cache.get(guild.roles.everyone.id);

    const isHiddenFromEveryone = everyoneOW?.deny.has("ViewChannel") || (parentEveryoneOW?.deny.has("ViewChannel") && !everyoneOW?.allow.has("ViewChannel"));

    if (isHiddenFromEveryone) {
      privateChannels.push({
        id: ch.id,
        name: ch.name,
        type: ch.type,
        category: parent?.name || "NO_CATEGORY",
        overwrites: ch.permissionOverwrites.cache.map(ow => {
          const role = guild.roles.cache.get(ow.id);
          return {
            target: role ? `@Role:${role.name}` : `@Member:${ow.id}`,
            id: ow.id,
            type: ow.type,
            allow: ow.allow.toArray(),
            deny: ow.deny.toArray()
          };
        })
      });
    }
  }

  for (const c of privateChannels) {
    console.log(`\n======================================================`);
    console.log(`Channel: #${c.name} (${c.id}) [Type: ${c.type}] in [${c.category}]`);
    console.log(`Overwrites (${c.overwrites.length}):`);
    for (const ow of c.overwrites) {
      console.log(`  - ${ow.target} (${ow.id}):`);
      if (ow.allow.length > 0) console.log(`      ALLOW: ${ow.allow.join(", ")}`);
      if (ow.deny.length > 0) console.log(`      DENY:  ${ow.deny.join(", ")}`);
    }
  }

  await client.destroy();
}
main().catch(console.error);
