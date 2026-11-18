import dotenv from "dotenv";
dotenv.config();
import {
  Client,
  GatewayIntentBits,
  TextChannel,
  NewsChannel,
  VoiceChannel,
  ColorResolvable,
} from "discord.js";

const GUILD_ID = "1507706011622965258";

// Exact text channel permission template from user's screenshots
const TEXT_TEMPLATE_PERMS = {
  // ALLOWED
  ViewChannel: true,
  SendMessages: true,
  EmbedLinks: true,
  AttachFiles: true,
  ReadMessageHistory: true,
  MentionEveryone: true,
  UseExternalEmojis: true,
  SendPolls: true,
  // DENIED
  CreateInstantInvite: false,
  ManageChannels: false,
  SendTTSMessages: false,
  ManageMessages: false,
  ManageRoles: false,
  ManageWebhooks: false,
  UseApplicationCommands: false,
  ManageThreads: false,
  CreatePublicThreads: false,
  CreatePrivateThreads: false,
  SendMessagesInThreads: false,
  UseEmbeddedActivities: false,
  SendVoiceMessages: false,
  UseExternalApps: false,
  PinMessages: false,
  BypassSlowmode: false,
};

// Private Voice Channel Permission Template
const VOICE_TEMPLATE_PERMS = {
  // ALLOWED
  ViewChannel: true,
  Connect: true,
  Speak: true,
  Stream: true,
  UseVAD: true,
  SendMessages: true,
  ReadMessageHistory: true,
  UseExternalEmojis: true,
  AddReactions: true,
  // DENIED
  CreateInstantInvite: false,
  ManageChannels: false,
  ManageRoles: false,
  MuteMembers: false,
  DeafenMembers: false,
  MoveMembers: false,
};

interface PrivateChannelMapping {
  channelId: string;
  channelName: string;
  roleName: string;
  roleColor: number;
  isVoice?: boolean;
}

const PRIVATE_CHANNELS: PrivateChannelMapping[] = [
  // ── Staff & Management ──
  {
    channelId: "1508536272048885853",
    channelName: "moderator-only",
    roleName: "🛡️ Moderator Only",
    roleColor: 0xe67e22,
  },

  // ── Friends Category (Private) ──
  {
    channelId: "1554170062305501337",
    channelName: "ᴄʜᴀᴛ",
    roleName: "💬 Friends Chat",
    roleColor: 0x3498db,
  },
  {
    channelId: "1558891417080827924",
    channelName: "media",
    roleName: "🖼️ Friends Media",
    roleColor: 0x1abc9c,
  },
  {
    channelId: "1558891440355156000",
    channelName: "dox",
    roleName: "📁 Friends Dox",
    roleColor: 0x95a5a6,
  },
  {
    channelId: "1559761306125471854",
    channelName: "update-channel",
    roleName: "📢 Friends Update",
    roleColor: 0xf39c12,
  },
  {
    channelId: "1570282778724016248",
    channelName: "informations",
    roleName: "ℹ️ Friends Info",
    roleColor: 0x3498db,
  },
  {
    channelId: "1554170127824588963",
    channelName: "Voice-Chat",
    roleName: "🎙️ Friends VC",
    roleColor: 0x2ecc71,
    isVoice: true,
  },
  {
    channelId: "1555846527375769650",
    channelName: "Event/Smp",
    roleName: "🏆 Friends Event VC",
    roleColor: 0xe67e22,
    isVoice: true,
  },
  {
    channelId: "1558891616125718569",
    channelName: "Pvp",
    roleName: "⚔️ Friends PvP VC",
    roleColor: 0xe74c3c,
    isVoice: true,
  },

  // ── Decay Category ──
  {
    channelId: "1561413169908289701",
    channelName: "decay",
    roleName: "💀 Decay Perms",
    roleColor: 0x34495e,
  },

  // ── Server Logs Category ──
  {
    channelId: "1508510765861310534",
    channelName: "voice-chat",
    roleName: "📋 VC Log View",
    roleColor: 0x7f8c8d,
  },
  {
    channelId: "1508519539388977163",
    channelName: "command-log",
    roleName: "📋 Command Log View",
    roleColor: 0x7f8c8d,
  },
  {
    channelId: "1508548021808398346",
    channelName: "join-log",
    roleName: "📋 Join Log View",
    roleColor: 0x7f8c8d,
  },
  {
    channelId: "1548374744695447623",
    channelName: "messege",
    roleName: "📋 Message Log View",
    roleColor: 0x7f8c8d,
  },

  // ── Verification & Transcript Logs ──
  {
    channelId: "1568477995101061192",
    channelName: "transcripts",
    roleName: "🎫 Transcript View",
    roleColor: 0x9b59b6,
  },
  {
    channelId: "1569042414474231988",
    channelName: "log-channel-verify",
    roleName: "📋 Verify Log View",
    roleColor: 0x7f8c8d,
  },

  // ── Private Voice in Voice-Chat Category ──
  {
    channelId: "1508511007017013379",
    channelName: "Hidden VC",
    roleName: "🔒 Hidden VC Access",
    roleColor: 0x34495e,
    isVoice: true,
  },
  {
    channelId: "1508833716603195422",
    channelName: "High Table",
    roleName: "👑 High Table Access",
    roleColor: 0xf1c40f,
    isVoice: true,
  },
];

async function main() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error("No token");

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(token);

  const guild = await client.guilds.fetch(GUILD_ID);
  console.log(`Connected to guild: ${guild.name}`);
  await guild.roles.fetch();

  for (const item of PRIVATE_CHANNELS) {
    console.log(`\nProcessing private channel #${item.channelName}...`);

    // 1. Resolve or create specific dedicated role
    let role = guild.roles.cache.find(
      (r) =>
        r.name.toLowerCase() === item.roleName.toLowerCase() ||
        r.name.toLowerCase().includes(item.roleName.toLowerCase().replace(/[^a-z0-9]/gi, ""))
    );

    if (!role) {
      console.log(`  Creating specific role "${item.roleName}"...`);
      role = await guild.roles.create({
        name: item.roleName,
        color: item.roleColor as ColorResolvable,
        reason: `Specific permission role for private #${item.channelName}`,
      });
      console.log(`  -> Created role "${role.name}" (${role.id})`);
    } else {
      console.log(`  -> Found existing role "${role.name}" (${role.id})`);
    }

    // 2. Fetch channel
    const ch = (await guild.channels.fetch(item.channelId).catch(() => null)) as
      | TextChannel
      | NewsChannel
      | VoiceChannel
      | null;

    if (!ch) {
      console.warn(`  Channel #${item.channelName} (${item.channelId}) not found!`);
      continue;
    }

    // 3. Ensure @everyone has ViewChannel: false (Strictly Private)
    const everyoneOW = ch.isVoiceBased()
      ? { ViewChannel: false, Connect: false }
      : { ViewChannel: false };

    await ch.permissionOverwrites.edit(guild.roles.everyone.id, everyoneOW, {
      reason: `Keep #${ch.name} strictly private from @everyone`,
    });

    // 4. Apply exact permission template for this dedicated role
    const permsToApply = item.isVoice ? VOICE_TEMPLATE_PERMS : TEXT_TEMPLATE_PERMS;
    await ch.permissionOverwrites.edit(role.id, permsToApply, {
      reason: `Set specific private channel role permissions for ${role.name}`,
    });

    console.log(`  -> Successfully configured dedicated role "${role.name}" on private #${ch.name}!`);
  }

  console.log("\nAll private channels have been successfully configured with dedicated roles!");
  await client.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
