import dotenv from "dotenv";
dotenv.config();
import { Client, GatewayIntentBits, PermissionsBitField } from "discord.js";

const GUILD_ID = "1507706011622965258";

const PRIVATE_CHANNELS_TO_VERIFY = [
  { id: "1508536272048885853", name: "moderator-only", roleName: "🛡️ Moderator Only", isVoice: false },
  { id: "1554170062305501337", name: "ᴄʜᴀᴛ", roleName: "💬 Friends Chat", isVoice: false },
  { id: "1558891417080827924", name: "media", roleName: "🖼️ Friends Media", isVoice: false },
  { id: "1558891440355156000", name: "dox", roleName: "📁 Friends Dox", isVoice: false },
  { id: "1559761306125471854", name: "update-channel", roleName: "📢 Friends Update", isVoice: false },
  { id: "1570282778724016248", name: "informations", roleName: "ℹ️ Friends Info", isVoice: false },
  { id: "1554170127824588963", name: "Voice-Chat", roleName: "🎙️ Friends VC", isVoice: true },
  { id: "1555846527375769650", name: "Event/Smp", roleName: "🏆 Friends Event VC", isVoice: true },
  { id: "1558891616125718569", name: "Pvp", roleName: "⚔️ Friends PvP VC", isVoice: true },
  { id: "1561413169908289701", name: "decay", roleName: "💀 Decay Perms", isVoice: false },
  { id: "1508510765861310534", name: "voice-chat", roleName: "📋 VC Log View", isVoice: false },
  { id: "1508519539388977163", name: "command-log", roleName: "📋 Command Log View", isVoice: false },
  { id: "1508548021808398346", name: "join-log", roleName: "📋 Join Log View", isVoice: false },
  { id: "1548374744695447623", name: "messege", roleName: "📋 Message Log View", isVoice: false },
  { id: "1568477995101061192", name: "transcripts", roleName: "🎫 Transcript View", isVoice: false },
  { id: "1569042414474231988", name: "log-channel-verify", roleName: "📋 Verify Log View", isVoice: false },
  { id: "1508511007017013379", name: "Hidden VC", roleName: "🔒 Hidden VC Access", isVoice: true },
  { id: "1508833716603195422", name: "High Table", roleName: "👑 High Table Access", isVoice: true },
];

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(token);

  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.roles.fetch();

  console.log(`Checking private channels on guild: ${guild.name}`);
  let allPass = true;

  for (const c of PRIVATE_CHANNELS_TO_VERIFY) {
    const channel: any = await guild.channels.fetch(c.id).catch(() => null);
    if (!channel) {
      console.log(`❌ Channel #${c.name} not found`);
      allPass = false;
      continue;
    }

    const role = guild.roles.cache.find((r) => r.name === c.roleName);
    if (!role) {
      console.log(`❌ Role "${c.roleName}" not found`);
      allPass = false;
      continue;
    }

    const everyoneOW = channel.permissionOverwrites.cache.get(guild.roles.everyone.id);
    const roleOW = channel.permissionOverwrites.cache.get(role.id);

    if (!everyoneOW || !everyoneOW.deny.has(PermissionsBitField.Flags.ViewChannel)) {
      console.log(`⚠️ #${channel.name} -> @everyone is not denied ViewChannel`);
      allPass = false;
    }

    if (!roleOW || !roleOW.allow.has(PermissionsBitField.Flags.ViewChannel)) {
      console.log(`⚠️ #${channel.name} -> Role "${role.name}" is missing ViewChannel`);
      allPass = false;
      continue;
    }

    if (!c.isVoice) {
      const allows = roleOW.allow;
      const denies = roleOW.deny;
      const hasView = allows.has(PermissionsBitField.Flags.ViewChannel);
      const hasSend = allows.has(PermissionsBitField.Flags.SendMessages);
      const hasEmbed = allows.has(PermissionsBitField.Flags.EmbedLinks);
      const hasAttach = allows.has(PermissionsBitField.Flags.AttachFiles);
      const hasMention = allows.has(PermissionsBitField.Flags.MentionEveryone);
      const hasPoll = allows.has(PermissionsBitField.Flags.SendPolls);
      const deniesManageCh = denies.has(PermissionsBitField.Flags.ManageChannels);
      const deniesThreads = denies.has(PermissionsBitField.Flags.ManageThreads);

      if (hasView && hasSend && hasEmbed && hasAttach && hasMention && hasPoll && deniesManageCh && deniesThreads) {
        console.log(`✅ Private #${channel.name} -> Role: "${role.name}" [Exact Screenshot Permissions Verified]`);
      } else {
        console.log(`⚠️ Private #${channel.name} -> Permission mismatch on role "${role.name}"`);
        allPass = false;
      }
    } else {
      const allows = roleOW.allow;
      const hasView = allows.has(PermissionsBitField.Flags.ViewChannel);
      const hasConnect = allows.has(PermissionsBitField.Flags.Connect);
      const hasSpeak = allows.has(PermissionsBitField.Flags.Speak);
      if (hasView && hasConnect && hasSpeak) {
        console.log(`✅ Private Voice #${channel.name} -> Role: "${role.name}" [Voice Access Verified]`);
      } else {
        console.log(`⚠️ Private Voice #${channel.name} -> Permission mismatch`);
        allPass = false;
      }
    }
  }

  console.log(`\nOverall Private Channels Status: ${allPass ? "ALL PRIVATE CHANNELS 100% CONFIGURED & VERIFIED! ✅" : "SOME ISSUES DETECTED ⚠️"}`);
  await client.destroy();
  process.exit(0);
}

main().catch(console.error);
