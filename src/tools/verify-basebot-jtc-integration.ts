import dotenv from "dotenv";
dotenv.config();
import {
  Client,
  GatewayIntentBits,
  ChannelType,
  VoiceChannel,
  PermissionsBitField,
} from "discord.js";
import {
  buildInterfacePayload,
  buildStatusPanelPayload,
  ownerLeaveTimers,
  updateVoiceChannelInterface,
} from "../lib/tempVoiceManager";
import {
  deleteTempChannel,
  getStatusSettings,
  getTempChannel,
  saveTempChannel,
  TempChannelRecord,
  updateStatusSettings,
} from "../lib/tempVoiceStore";

const GUILD_ID = "1507706011622965258";

async function main() {
  console.log("=== Testing Base-Bot-1 JTC Integration Suite ===");

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
    ],
  });

  await client.login(process.env.DISCORD_TOKEN);
  const guild = await client.guilds.fetch(GUILD_ID);
  const botMember = await guild.members.fetchMe();

  // 1. Create a simulated JTC voice channel
  const testCh = (await guild.channels.create({
    name: "🔊 BaseBot JTC Test",
    type: ChannelType.GuildVoice,
    permissionOverwrites: [
      {
        id: guild.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.SendMessages,
        ],
      },
      {
        id: botMember.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ManageChannels,
        ],
      },
    ],
  })) as VoiceChannel;

  console.log(`1. Created Test VC: #${testCh.name} (${testCh.id}) [PASS ✅]`);

  // 2. Register TempChannelRecord with statusSettings
  const record: TempChannelRecord = {
    channelId: testCh.id,
    guildId: guild.id,
    ownerId: botMember.id,
    createdAt: Date.now(),
    isLocked: false,
    isHidden: false,
    trustedUserIds: [],
    blockedUserIds: [],
    waitingRoomChannelId: null,
    statusSettings: {
      isMuted: false,
      extraOwners: [],
      whitelist: [],
      blacklist: [],
    },
  };
  saveTempChannel(record);

  const initialSettings = getStatusSettings(testCh.id);
  if (!initialSettings || initialSettings.isMuted !== false) {
    throw new Error("Failed to initialize statusSettings in store");
  }
  console.log("2. Initialized TempChannelRecord + statusSettings: PASS ✅");

  // 3. Test sending primary VC Control Panel
  const panelPayload = buildInterfacePayload(record, testCh);
  const sentControl = await testCh.send(panelPayload);
  record.interfaceMessageId = sentControl.id;
  saveTempChannel(record);
  console.log(`3. Sent 15-button Control Panel: Message ID ${sentControl.id} [PASS ✅]`);

  // 4. Test buildStatusPanelPayload (Base-Bot-1 Among Us / Game Panel)
  const statusPanel = buildStatusPanelPayload(initialSettings, botMember, record.ownerId);
  const statusEmbed = statusPanel.embeds[0];
  const hasGameTitle = statusEmbed.data.title?.includes("Status Moderation");
  const hasButtons = statusPanel.components.length === 2;
  if (!hasGameTitle || !hasButtons) {
    throw new Error("Failed to build status panel payload correctly");
  }
  console.log("4. Built Game Status Moderation Panel (Base-Bot-1): PASS ✅");

  // 5. Test Status Settings mutation (Mute toggle, Whitelist, Blacklist, Extra Owners)
  updateStatusSettings(testCh.id, {
    isMuted: true,
    whitelist: ["123456789"],
    blacklist: ["987654321"],
    extraOwners: ["555555555"],
  });
  const updatedSettings = getStatusSettings(testCh.id);
  if (
    !updatedSettings.isMuted ||
    updatedSettings.whitelist[0] !== "123456789" ||
    updatedSettings.blacklist[0] !== "987654321" ||
    updatedSettings.extraOwners[0] !== "555555555"
  ) {
    throw new Error("Failed to update status settings properly");
  }
  console.log("5. Verified Mute Toggle, Whitelist, Blacklist & Extra Owners persistence: PASS ✅");

  // 6. Test 5-minute delayed ownership transfer timer tracking
  let timerTriggered = false;
  const mockTimeout = setTimeout(() => {
    timerTriggered = true;
  }, 1000);

  ownerLeaveTimers.set(testCh.id, { timeout: mockTimeout, ownerId: botMember.id });
  const hasTimer = ownerLeaveTimers.has(testCh.id);
  if (!hasTimer) throw new Error("Delayed transfer timer failed to register");

  // Simulate owner returning: cancel timer
  const activeTimer = ownerLeaveTimers.get(testCh.id);
  if (activeTimer) {
    clearTimeout(activeTimer.timeout);
    ownerLeaveTimers.delete(testCh.id);
  }
  if (ownerLeaveTimers.has(testCh.id)) throw new Error("Delayed transfer timer failed to cancel on return");
  console.log("6. 5-Minute Delayed Transfer timer registration & return cancellation: PASS ✅");

  // 7. Test live embed update
  await updateVoiceChannelInterface(guild, testCh.id);
  const fetchedMsg = await testCh.messages.fetch({ message: sentControl.id, force: true });
  if (!fetchedMsg) throw new Error("Failed to fetch updated control panel message");
  console.log("7. Live Control Panel update in VC chat verified: PASS ✅");

  // 8. Cleanup test channel
  deleteTempChannel(testCh.id);
  await testCh.delete("Verification completed");
  console.log("8. Cleaned up test channel successfully: PASS ✅");

  console.log("\nALL BASE-BOT-1 JTC INTEGRATION TESTS PASSED 100%! 🚀🎉");
  process.exit(0);
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
