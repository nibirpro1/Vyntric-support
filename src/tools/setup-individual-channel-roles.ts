import dotenv from "dotenv";
dotenv.config();
import {
  Client,
  GatewayIntentBits,
  TextChannel,
  NewsChannel,
  ColorResolvable,
} from "discord.js";

const GUILD_ID = "1507706011622965258";

// Exact permission template from user's screenshots
const TEMPLATE_PERMS = {
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

interface ChannelRoleMapping {
  channelId: string;
  channelName: string;
  roleName: string;
  roleColor: number;
  existingRoleId?: string;
  removeOtherRoles?: string[];
}

const CHANNEL_ROLES: ChannelRoleMapping[] = [
  // ── UHC Category ──
  {
    channelId: "1571037814785708072",
    channelName: "〢ᴜʜᴄ-ᴀɴɴoᴜnᴄᴍᴇɴᴛ",
    roleName: "⚔️ UHC Announce",
    roleColor: 0xe74c3c,
    existingRoleId: "1571405118786633798",
  },
  {
    channelId: "1555978972519469117",
    channelName: "〢ᴜʜᴄ-ᴇᴠᴇɴᴛꜱ",
    roleName: "🏆 UHC Events",
    roleColor: 0xe67e22,
    removeOtherRoles: ["1571405118786633798"], // Remove generic UHC Announce
  },
  {
    channelId: "1554021358600462418",
    channelName: "〢ᴜʜᴄ-ʀᴜʟᴇꜱ",
    roleName: "📜 UHC Rules",
    roleColor: 0x95a5a6,
    removeOtherRoles: ["1571405118786633798"],
  },
  {
    channelId: "1571738204862943265",
    channelName: "〢ᴜʜᴄ-ᴘᴏʟʟ",
    roleName: "📊 UHC Poll",
    roleColor: 0x3498db,
    removeOtherRoles: ["1571405118786633798"],
  },

  // ── Vyntric Category ──
  {
    channelId: "1553815259507204126",
    channelName: "〢ᴀɴᴜonᴄᴍᴇɴᴛ",
    roleName: "📢 Server Announce",
    roleColor: 0xf39c12,
    existingRoleId: "1571405116869840926",
  },
  {
    channelId: "1554018991759032320",
    channelName: "〢ʀᴜʟᴇ",
    roleName: "📜 Server Rules",
    roleColor: 0x95a5a6,
    removeOtherRoles: ["1571405116869840926"],
  },
  {
    channelId: "1552331192546623598",
    channelName: "〢ɢɪᴠᴇᴀᴡᴀʏꜱ",
    roleName: "🎁 Giveaway Perms",
    roleColor: 0x9b59b6,
    existingRoleId: "1571258781487210660",
  },
  {
    channelId: "1548372966012751953",
    channelName: "〢ᴜᴘʟᴏᴀᴅꜱ",
    roleName: "📤 Server Uploads",
    roleColor: 0x1abc9c,
    removeOtherRoles: ["1571405116869840926"],
  },
  {
    channelId: "1568597809152794664",
    channelName: "〢ᴘᴀʀᴛɴᴇʀsʜɪᴘ",
    roleName: "🤝 Partnership Perms",
    roleColor: 0x369876,
    removeOtherRoles: ["1571405116869840926"],
  },

  // ── Important Category ──
  {
    channelId: "1516108491226349609",
    channelName: "〢ᴡᴇʟᴄᴏᴍᴇ",
    roleName: "👋 Welcome Perms",
    roleColor: 0x2ecc71,
    removeOtherRoles: ["1571405116869840926"],
  },
  {
    channelId: "1548373129510781041",
    channelName: "〢ʙᴏᴏꜱᴛ",
    roleName: "🚀 Boost Channel Perms",
    roleColor: 0xf47fff,
    removeOtherRoles: ["1571405116869840926"],
  },
  {
    channelId: "1551792726243287130",
    channelName: "〢ʀᴏʟᴇꜱ",
    roleName: "🏷️ Roles Channel Perms",
    roleColor: 0x9b59b6,
    removeOtherRoles: ["1571405116869840926"],
  },
  {
    channelId: "1572120220305465504",
    channelName: "〢ɪɴꜰᴏ",
    roleName: "ℹ️ Info Perms",
    roleColor: 0x3498db,
    removeOtherRoles: ["1571405116869840926"],
  },

  // ── SMP Category ──
  {
    channelId: "1555881019683373107",
    channelName: "〢ꜱᴍᴘ-ᴀɴɴᴜᴄᴍᴇɴᴛ",
    roleName: "⛏️ SMP Announce",
    roleColor: 0x2ecc71,
    existingRoleId: "1572502172992798730",
  },
  {
    channelId: "1553454006280527893",
    channelName: "〢ꜱᴍᴘ-ᴠᴏᴛᴇ",
    roleName: "🗳️ SMP Vote",
    roleColor: 0x3498db,
    removeOtherRoles: ["1572502172992798730"],
  },
  {
    channelId: "1553678466627539035",
    channelName: "〢ꜱᴍᴘ-ʀᴜʟᴇꜱ",
    roleName: "📜 SMP Rules",
    roleColor: 0x95a5a6,
    removeOtherRoles: ["1572502172992798730"],
  },
  {
    channelId: "1550919195435474956",
    channelName: "〢ꜱᴍᴘ-ɪɴꜰᴏ",
    roleName: "ℹ️ SMP Info",
    roleColor: 0x1abc9c,
    removeOtherRoles: ["1572502172992798730"],
  },
  {
    channelId: "1550794223156989982",
    channelName: "〢ʀᴇᴄɪᴘᴇꜱ",
    roleName: "📖 SMP Recipes",
    roleColor: 0xf39c12,
    removeOtherRoles: ["1572502172992798730"],
  },
  {
    channelId: "1550799608811360348",
    channelName: "〢ᴡʜɪᴛᴇʟɪꜱᴛ",
    roleName: "📋 SMP Whitelist",
    roleColor: 0xe67e22,
    removeOtherRoles: ["1572502172992798730"],
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

  for (const item of CHANNEL_ROLES) {
    console.log(`\nProcessing #${item.channelName}...`);

    // 1. Resolve or create specific role
    let role = item.existingRoleId
      ? guild.roles.cache.get(item.existingRoleId)
      : guild.roles.cache.find(
          (r) =>
            r.name.toLowerCase() === item.roleName.toLowerCase() ||
            r.name.toLowerCase().includes(item.roleName.toLowerCase().replace(/[^a-z0-9]/gi, ""))
        );

    if (!role) {
      console.log(`  Creating specific role "${item.roleName}"...`);
      role = await guild.roles.create({
        name: item.roleName,
        color: item.roleColor as ColorResolvable,
        reason: `Specific permission role for #${item.channelName}`,
      });
      console.log(`  -> Created role "${role.name}" (${role.id})`);
    } else {
      console.log(`  -> Found role "${role.name}" (${role.id})`);
    }

    // 2. Fetch channel
    const ch = (await guild.channels.fetch(item.channelId).catch(() => null)) as
      | TextChannel
      | NewsChannel
      | null;

    if (!ch) {
      console.warn(`  Channel ${item.channelName} (${item.channelId}) not found!`);
      continue;
    }

    // 3. Remove any previous generic announce roles from this channel if requested
    if (item.removeOtherRoles && item.removeOtherRoles.length > 0) {
      for (const oldRoleId of item.removeOtherRoles) {
        if (oldRoleId !== role.id && ch.permissionOverwrites.cache.has(oldRoleId)) {
          console.log(`  Removing shared role ${oldRoleId} overwrite from #${ch.name}...`);
          await ch.permissionOverwrites.delete(oldRoleId, "Remove shared role to enforce dedicated channel role").catch(() => {});
        }
      }
    }

    // 4. Set @everyone: read-only (ViewChannel: true, ReadMessageHistory: true, SendMessages: false)
    await ch.permissionOverwrites.edit(
      guild.roles.everyone.id,
      {
        ViewChannel: true,
        ReadMessageHistory: true,
        SendMessages: false,
      },
      { reason: `Make #${ch.name} read-only for @everyone` }
    );

    // 5. Apply the EXACT screenshot permission template for this specific role
    await ch.permissionOverwrites.edit(
      role.id,
      TEMPLATE_PERMS,
      { reason: `Set specific channel role permissions for ${role.name}` }
    );

    console.log(`  -> Successfully configured dedicated role "${role.name}" on #${ch.name}!`);
  }

  console.log("\nAll dedicated channel roles and permissions have been successfully configured!");
  await client.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
