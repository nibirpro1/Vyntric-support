import dotenv from "dotenv";
dotenv.config();
import { Client, GatewayIntentBits, ChannelType, PermissionsBitField, VoiceChannel } from "discord.js";
import { buildInterfacePayload, updateVoiceChannelInterface } from "../lib/tempVoiceManager";
import { getTempChannel, saveTempChannel, deleteTempChannel, TempChannelRecord } from "../lib/tempVoiceStore";

const GUILD_ID = "1507706011622965258";

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
  await client.login(process.env.DISCORD_TOKEN);
  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.roles.fetch();

  const botId = client.user?.id || (await guild.members.fetchMe()).id;
  console.log("=== Testing Advanced TempVoice Pro System ===");

  // 1. Create simulated temporary channel
  const testChannelName = "🔊 Ultra HQ Voice Test";
  const tempCh = await guild.channels.create({
    name: testChannelName,
    type: ChannelType.GuildVoice,
    parent: "1572303631246434436",
    userLimit: 5,
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

  // 2. Register in store with initial record
  const initialRecord: TempChannelRecord = {
    channelId: tempCh.id,
    guildId: guild.id,
    ownerId: botId,
    createdAt: Date.now(),
    isLocked: false,
    isHidden: false,
    trustedUserIds: ["1137236029523361945"],
    blockedUserIds: [],
    waitingRoomChannelId: null,
  };
  saveTempChannel(initialRecord);

  // 3. Send initial live interface into VC text chat
  const payload = buildInterfacePayload(initialRecord, tempCh);
  const sent = await tempCh.send(payload);
  initialRecord.interfaceMessageId = sent.id;
  saveTempChannel(initialRecord);
  console.log(`2. Sent initial live interface! Message ID: ${sent.id} [PASS ✅]`);

  // 4. Test live update: lock channel, set limit to 10, enable ghost mode
  console.log("3. Testing live update: locking channel and enabling ghost mode...");
  initialRecord.isLocked = true;
  initialRecord.isHidden = true;
  saveTempChannel(initialRecord);

  await updateVoiceChannelInterface(guild, tempCh.id);
  const updatedMsg = await tempCh.messages.fetch({ message: sent.id, force: true });
  const desc = updatedMsg.embeds[0]?.description || "";
  console.log("Updated description snippet:", desc.slice(0, 150));
  const hasLocked = desc.includes("🔒 Locked");
  const hasHidden = desc.includes("👻 Hidden");
  console.log("   - Live Embed Updated with 🔒 Locked:", hasLocked ? "PASS ✅" : "FAIL ❌");
  console.log("   - Live Embed Updated with 👻 Hidden:", hasHidden ? "PASS ✅" : "FAIL ❌");

  // 5. Clean up
  deleteTempChannel(tempCh.id);
  await tempCh.delete("Test finished");
  console.log("4. Cleaned up test channel successfully [PASS ✅]");

  if (hasLocked && hasHidden) {
    console.log("\nALL ADVANCED TEMPEVOICE PRO TESTS PASSED 100%! 🚀🎉");
  } else {
    console.log("\nSOME CHECKS FAILED! ⚠️");
  }

  await client.destroy();
  process.exit(0);
}

main().catch(console.error);
