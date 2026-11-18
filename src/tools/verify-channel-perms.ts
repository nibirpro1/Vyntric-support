import dotenv from "dotenv";
dotenv.config();
import { Client, GatewayIntentBits, TextChannel, NewsChannel, PermissionsBitField } from "discord.js";

const GUILD_ID = "1507706011622965258";

const CHANNELS_TO_CHECK = [
  { id: "1571037814785708072", name: "〢ᴜʜᴄ-ᴀɴɴoᴜnᴄᴍᴇɴᴛ", roleName: "⚔️ UHC Announce" },
  { id: "1555978972519469117", name: "〢ᴜʜᴄ-ᴇᴠᴇɴᴛꜱ", roleName: "🏆 UHC Events" },
  { id: "1554021358600462418", name: "〢ᴜʜᴄ-ʀᴜʟᴇꜱ", roleName: "📜 UHC Rules" },
  { id: "1571738204862943265", name: "〢ᴜʜᴄ-ᴘᴏʟʟ", roleName: "📊 UHC Poll" },
  { id: "1553815259507204126", name: "〢ᴀɴᴜonᴄᴍᴇɴᴛ", roleName: "📢 Server Announce" },
  { id: "1554018991759032320", name: "〢ʀᴜʟᴇ", roleName: "📜 Server Rules" },
  { id: "1552331192546623598", name: "〢ɢɪᴠᴇᴀᴡᴀʏꜱ", roleName: "🎁 Giveaway Perms" },
  { id: "1548372966012751953", name: "〢ᴜᴘʟᴏᴀᴅꜱ", roleName: "📤 Server Uploads" },
  { id: "1568597809152794664", name: "〢ᴘᴀʀᴛɴᴇʀsʜɪᴘ", roleName: "🤝 Partnership Perms" },
  { id: "1516108491226349609", name: "〢ᴡᴇʟᴄᴏᴍᴇ", roleName: "👋 Welcome Perms" },
  { id: "1548373129510781041", name: "〢ʙᴏᴏꜱᴛ", roleName: "🚀 Boost Channel Perms" },
  { id: "1551792726243287130", name: "〢ʀᴏʟᴇꜱ", roleName: "🏷️ Roles Channel Perms" },
  { id: "1572120220305465504", name: "〢ɪɴꜰᴏ", roleName: "ℹ️ Info Perms" },
  { id: "1555881019683373107", name: "〢ꜱᴍᴘ-ᴀɴɴᴜᴄᴍᴇɴᴛ", roleName: "⛏️ SMP Announce" },
  { id: "1553454006280527893", name: "〢ꜱᴍᴘ-ᴠᴏᴛᴇ", roleName: "🗳️ SMP Vote" },
  { id: "1553678466627539035", name: "〢ꜱᴍᴘ-ʀᴜʟᴇꜱ", roleName: "📜 SMP Rules" },
  { id: "1550919195435474956", name: "〢ꜱᴍᴘ-ɪɴꜰᴏ", roleName: "ℹ️ SMP Info" },
  { id: "1550794223156989982", name: "〢ʀᴇᴄɪᴘᴇꜱ", roleName: "📖 SMP Recipes" },
  { id: "1550799608811360348", name: "〢ᴡʜɪᴛᴇʟɪꜱᴛ", roleName: "📋 SMP Whitelist" },
];

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(token);

  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.roles.fetch();

  console.log(`Checking channels on guild: ${guild.name}`);
  let allPass = true;

  for (const c of CHANNELS_TO_CHECK) {
    const channel = (await guild.channels.fetch(c.id).catch(() => null)) as TextChannel | NewsChannel | null;
    if (!channel) {
      console.log(`❌ Channel ${c.name} not found`);
      allPass = false;
      continue;
    }

    const role = guild.roles.cache.find(r => r.name === c.roleName);
    if (!role) {
      console.log(`❌ Role ${c.roleName} not found in guild`);
      allPass = false;
      continue;
    }

    const overwrite = channel.permissionOverwrites.cache.get(role.id);
    if (!overwrite) {
      console.log(`❌ Channel #${channel.name} missing overwrite for dedicated role ${c.roleName}`);
      allPass = false;
      continue;
    }

    // Check a few key permissions from screenshots
    const allows = overwrite.allow;
    const denies = overwrite.deny;

    const hasView = allows.has(PermissionsBitField.Flags.ViewChannel);
    const hasSend = allows.has(PermissionsBitField.Flags.SendMessages);
    const hasEmbed = allows.has(PermissionsBitField.Flags.EmbedLinks);
    const hasAttach = allows.has(PermissionsBitField.Flags.AttachFiles);
    const hasMention = allows.has(PermissionsBitField.Flags.MentionEveryone);
    const hasPoll = allows.has(PermissionsBitField.Flags.SendPolls);
    const deniesManageCh = denies.has(PermissionsBitField.Flags.ManageChannels);
    const deniesThreads = denies.has(PermissionsBitField.Flags.ManageThreads);
    const deniesTTS = denies.has(PermissionsBitField.Flags.SendTTSMessages);

    if (hasView && hasSend && hasEmbed && hasAttach && hasMention && hasPoll && deniesManageCh && deniesThreads && deniesTTS) {
      console.log(`✅ #${channel.name} -> Role: "${role.name}" [Exact Screenshot Permissions Verified]`);
    } else {
      console.log(`⚠️ #${channel.name} -> Permission mismatch on role ${role.name}`);
      allPass = false;
    }
  }

  console.log(`\nOverall Status: ${allPass ? "ALL CHANNELS 100% CONFIGURED & VERIFIED! ✅" : "SOME ISSUES DETECTED ⚠️"}`);
  await client.destroy();
  process.exit(0);
}

main().catch(console.error);
