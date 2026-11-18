import dotenv from "dotenv";
dotenv.config();
import { Client, GatewayIntentBits } from "discord.js";

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN);
  const guild = await client.guilds.fetch("1507706011622965258");

  const logChannelIds = [
    "1508510765861310534", // #voice-chat log
    "1508519539388977163", // #command-log
    "1508548021808398346", // #join-log
    "1548374744695447623", // #messege log
    "1569042414474231988", // #log-channel-verify
    "1568477995101061192", // #transcripts
  ];

  console.log("=== SERVER LOGS CHANNELS DETAILS ===");
  for (const id of logChannelIds) {
    const ch: any = await guild.channels.fetch(id).catch(() => null);
    if (!ch) continue;
    console.log(`Channel: #${ch.name} (${ch.id}) | Parent: ${ch.parent?.name}`);
    for (const [targetId, ow] of ch.permissionOverwrites.cache) {
      const role = guild.roles.cache.get(targetId);
      console.log(`  - ${role ? role.name : targetId}: allow=${ow.allow.toArray().join(",")} deny=${ow.deny.toArray().join(",")}`);
    }
  }

  await client.destroy();
}
main().catch(console.error);
