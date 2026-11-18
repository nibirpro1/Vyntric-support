import dotenv from "dotenv";
dotenv.config();
import {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  Role,
  GuildChannel,
  TextChannel,
  NewsChannel,
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

async function main() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error("No token");

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(token);

  const guild = await client.guilds.fetch(GUILD_ID);
  console.log(`Connected to guild: ${guild.name}`);

  // Fetch or create SMP Announce role
  await guild.roles.fetch();
  let smpAnnounceRole = guild.roles.cache.find(
    (r) =>
      r.name.toLowerCase() === "smp announce" ||
      r.name === "⛏️ SMP Announce" ||
      r.name.includes("SMP Announce")
  );

  if (!smpAnnounceRole) {
    console.log("Creating dedicated role '⛏️ SMP Announce'...");
    smpAnnounceRole = await guild.roles.create({
      name: "⛏️ SMP Announce",
      color: 0x2ecc71, // Green
      reason: "Dedicated permission role for SMP announcement channels",
    });
    console.log(`Created SMP Announce role: ${smpAnnounceRole.name} (${smpAnnounceRole.id})`);
  } else {
    console.log(`Found existing SMP Announce role: ${smpAnnounceRole.name} (${smpAnnounceRole.id})`);
  }

  const roleMap = {
    serverAnnounce: "1571405116869840926",
    uhcAnnounce: "1571405118786633798",
    giveawayPerms: "1571258781487210660",
    partners: "1570773179415269459",
    smpAnnounce: smpAnnounceRole.id,
    mediaPerms: "1571258778081558548",
  };

  // Channels configuration
  const configs: Array<{
    channelId: string;
    roleId: string;
    roleName: string;
    channelDesc: string;
  }> = [
    // UHC Channels
    { channelId: "1571037814785708072", roleId: roleMap.uhcAnnounce, roleName: "⚔️ UHC Announce", channelDesc: "UHC Announcement" },
    { channelId: "1555978972519469117", roleId: roleMap.uhcAnnounce, roleName: "⚔️ UHC Announce", channelDesc: "UHC Events" },
    { channelId: "1554021358600462418", roleId: roleMap.uhcAnnounce, roleName: "⚔️ UHC Announce", channelDesc: "UHC Rules" },
    { channelId: "1571738204862943265", roleId: roleMap.uhcAnnounce, roleName: "⚔️ UHC Announce", channelDesc: "UHC Poll" },

    // Server Announcement & Info Channels
    { channelId: "1553815259507204126", roleId: roleMap.serverAnnounce, roleName: "📢 Server Announce", channelDesc: "Server Announcement" },
    { channelId: "1554018991759032320", roleId: roleMap.serverAnnounce, roleName: "📢 Server Announce", channelDesc: "Server Rules" },
    { channelId: "1548372966012751953", roleId: roleMap.serverAnnounce, roleName: "📢 Server Announce", channelDesc: "Server Uploads" },
    { channelId: "1516108491226349609", roleId: roleMap.serverAnnounce, roleName: "📢 Server Announce", channelDesc: "Welcome Channel" },
    { channelId: "1548373129510781041", roleId: roleMap.serverAnnounce, roleName: "📢 Server Announce", channelDesc: "Boost Channel" },
    { channelId: "1551792726243287130", roleId: roleMap.serverAnnounce, roleName: "📢 Server Announce", channelDesc: "Roles Channel" },
    { channelId: "1572120220305465504", roleId: roleMap.serverAnnounce, roleName: "📢 Server Announce", channelDesc: "Info Channel" },

    // Giveaway Channel
    { channelId: "1552331192546623598", roleId: roleMap.giveawayPerms, roleName: "🎁 Giveaway Perms", channelDesc: "Giveaways Channel" },

    // Partnership Channel
    { channelId: "1568597809152794664", roleId: roleMap.partners, roleName: "Pertners", channelDesc: "Partnership Channel" },
    { channelId: "1568597809152794664", roleId: roleMap.serverAnnounce, roleName: "📢 Server Announce", channelDesc: "Partnership Channel" },

    // SMP Channels
    { channelId: "1555881019683373107", roleId: roleMap.smpAnnounce, roleName: "⛏️ SMP Announce", channelDesc: "SMP Announcement" },
    { channelId: "1553454006280527893", roleId: roleMap.smpAnnounce, roleName: "⛏️ SMP Announce", channelDesc: "SMP Vote" },
    { channelId: "1553678466627539035", roleId: roleMap.smpAnnounce, roleName: "⛏️ SMP Announce", channelDesc: "SMP Rules" },
    { channelId: "1550919195435474956", roleId: roleMap.smpAnnounce, roleName: "⛏️ SMP Announce", channelDesc: "SMP Info" },
    { channelId: "1550794223156989982", roleId: roleMap.smpAnnounce, roleName: "⛏️ SMP Announce", channelDesc: "SMP Recipes" },
    { channelId: "1550799608811360348", roleId: roleMap.smpAnnounce, roleName: "⛏️ SMP Announce", channelDesc: "SMP Whitelist" },
  ];

  for (const cfg of configs) {
    const ch = (await guild.channels.fetch(cfg.channelId).catch(() => null)) as TextChannel | NewsChannel | null;
    if (!ch) {
      console.warn(`Channel ${cfg.channelDesc} (${cfg.channelId}) not found.`);
      continue;
    }

    console.log(`Setting overwrites on #${ch.name} (${cfg.channelDesc}) for role "${cfg.roleName}"...`);
    try {
      // 1. Ensure @everyone cannot send messages on these announcement/info channels
      await ch.permissionOverwrites.edit(
        guild.roles.everyone.id,
        {
          ViewChannel: true,
          ReadMessageHistory: true,
          SendMessages: false,
        },
        { reason: "Ensure announcement/info channel is read-only for @everyone" }
      );

      // 2. Set the role overwrite according to exact template
      await ch.permissionOverwrites.edit(
        cfg.roleId,
        TEMPLATE_PERMS,
        { reason: `Set specific role permissions for ${cfg.roleName}` }
      );

      console.log(`  -> Successfully configured #${ch.name}!`);
    } catch (err: any) {
      console.error(`  -> Failed to configure #${ch.name}:`, err.message);
    }
  }

  console.log("\nAll channel permission overwrites configured successfully!");
  await client.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
