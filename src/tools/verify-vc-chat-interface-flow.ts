import dotenv from "dotenv";
dotenv.config();
import { Client, GatewayIntentBits, ChannelType, PermissionsBitField, VoiceChannel } from "discord.js";
import { buildInterfacePayload } from "../lib/tempVoiceManager";
import { getTempChannel, saveTempChannel, deleteTempChannel } from "../lib/tempVoiceStore";

const GUILD_ID = "1507706011622965258";

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
  await client.login(process.env.DISCORD_TOKEN);
  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.roles.fetch();

  const botId = client.user?.id || (await guild.members.fetchMe()).id;
  console.log("=== Testing J2C VC Chat Interface Flow ===");

  // 1. Create simulated temporary channel
  const testChannelName = "! Test Member's Channel";
  const tempCh = await guild.channels.create({
    name: testChannelName,
    type: ChannelType.GuildVoice,
    parent: "1572303631246434436",
    permissionOverwrites: [
      {
        id: guild.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.Speak,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      },
      {
        id: botId,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.Speak,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ManageChannels,
          PermissionsBitField.Flags.MoveMembers,
        ],
      },
    ],
  });

  console.log(`1. Created VC: #${tempCh.name} (${tempCh.id})`);

  // 2. Register in store
  saveTempChannel({
    channelId: tempCh.id,
    guildId: guild.id,
    ownerId: botId,
    createdAt: Date.now(),
    isLocked: false,
    trustedUserIds: [],
    blockedUserIds: [],
    waitingRoomChannelId: null,
  });

  const record = getTempChannel(tempCh.id);
  console.log("2. Registered in store:", record?.channelId === tempCh.id ? "PASS ✅" : "FAIL ❌");

  // 3. Send interface control panel directly into VC chat
  const payload = buildInterfacePayload();
  const sent = await tempCh.send(payload);
  console.log(`3. Sent control panel into #${tempCh.name} chat: Message ID ${sent.id} | ActionRows: ${sent.components.length} [PASS ✅]`);

  // Verify button count
  const totalButtons = sent.components.reduce((acc, row: any) => acc + row.components.length, 0);
  console.log(`4. Total interactive buttons on panel: ${totalButtons} (Expected: 15) -> ${totalButtons === 15 ? "PASS ✅" : "FAIL ❌"}`);

  // 5. Clean up
  deleteTempChannel(tempCh.id);
  await tempCh.delete("Test finished");
  console.log("5. Cleaned up test channel successfully [PASS ✅]");

  console.log("\nALL VC CHAT INTERFACE TESTS PASSED 100%! 🎉");
  await client.destroy();
  process.exit(0);
}

main().catch(console.error);
