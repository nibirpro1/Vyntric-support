import dotenv from "dotenv";
dotenv.config();
import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import { setupInterfaceChannel } from "../lib/tempVoiceManager";
import { setTempVoiceConfig } from "../lib/tempVoiceStore";

const GUILD_ID = "1507706011622965258";
const INTERFACE_CHANNEL_ID = "1572303634178248946";

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN);
  const guild = await client.guilds.fetch(GUILD_ID);
  const ifaceChannel = (await guild.channels.fetch(INTERFACE_CHANNEL_ID)) as TextChannel;

  console.log(`Setting up TempVoice interface in #${ifaceChannel.name}...`);
  const messageId = await setupInterfaceChannel(ifaceChannel, false);

  setTempVoiceConfig(GUILD_ID, {
    creatorChannelId: "1572303632622289047",
    categoryId: "1572303631246434436",
    interfaceChannelId: INTERFACE_CHANNEL_ID,
    interfaceMessageId: messageId,
  });

  console.log(`✅ TempVoice interface successfully posted! Message ID: ${messageId}`);
  await client.destroy();
}
main().catch(console.error);
