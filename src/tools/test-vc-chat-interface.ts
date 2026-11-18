import dotenv from "dotenv";
dotenv.config();
import { Client, GatewayIntentBits, ChannelType, PermissionsBitField, VoiceChannel } from "discord.js";
import { buildInterfacePayload } from "../lib/tempVoiceManager";

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
  await client.login(process.env.DISCORD_TOKEN);
  const guild = await client.guilds.fetch("1507706011622965258");
  await guild.roles.fetch();
  const botId = client.user?.id || (await guild.members.fetchMe()).id;

  console.log("Creating test temporary voice channel with botId:", botId);
  const testCh = await guild.channels.create({
    name: "🔊 Test Voice Chat",
    type: ChannelType.GuildVoice,
    parent: "1572303631246434436", // J2C Category
    permissionOverwrites: [
      {
        id: guild.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.SendMessages],
      },
      {
        id: botId,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.ManageChannels,
        ],
      },
    ],
  });

  console.log(`Created test channel #${testCh.name} (${testCh.id})`);
  console.log("Sending interface payload into test channel's text chat...");
  const payload = buildInterfacePayload();
  const sent = await testCh.send(payload);
  console.log(`✅ Successfully sent interface into Voice Channel chat! Message ID: ${sent.id}`);

  // Delete test channel
  console.log("Cleaning up test channel...");
  await testCh.delete();
  console.log("Test channel deleted!");

  await client.destroy();
}
main().catch(console.error);
