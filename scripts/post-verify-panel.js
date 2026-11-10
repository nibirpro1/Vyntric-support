const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

const GUILD_ID = '1507706011622965258';
const CHANNEL_ID = '1560933139134545950'; // # 〢verify
const BANNER_PATH = path.resolve(__dirname, '..', 'assets', 'banners', 'vyntric-verify.png');

async function main() {
  console.log('Posting verification panel to channel:', CHANNEL_ID);

  const bannerExists = fs.existsSync(BANNER_PATH);
  console.log('Banner exists:', bannerExists, BANNER_PATH);

  const embed = {
    title: '🔐 SERVER VERIFICATION',
    color: 0xb1121f, // Crimson Red
    description:
      `Welcome to **Vyntric**!\n\n` +
      `To gain access to all channels, view the community, and participate in discussions, you must complete member verification.\n\n` +
      `📋 **How to verify:**\n` +
      `React with the **✅** emoji below to verify and unlock full access to the server.\n\n` +
      `*(No links, buttons, or external authorizations needed — simply react with ✅ below!)*\n\n` +
      `📌 **Rules & Guidelines:**\n` +
      `• Follow the official [Discord Terms of Service](https://discord.com/terms) & [Community Guidelines](https://discord.com/guidelines).\n` +
      `• Be respectful to all members and staff. Zero tolerance for harassment or hate speech.\n` +
      `• No advertising, unsolicited DMs, spam, or malicious links.\n` +
      `• No NSFW content or disruptive behavior.`,
    footer: {
      text: 'Plugsy Security • React with ✅ below to verify',
    },
    timestamp: new Date().toISOString(),
  };

  const files = [];
  if (bannerExists) {
    const fileBuffer = fs.readFileSync(BANNER_PATH);
    embed.image = { url: 'attachment://vyntric-verify.png' };
    files.push({
      name: 'vyntric-verify.png',
      data: fileBuffer,
      contentType: 'image/png',
    });
  }

  // Clear any old messages in verify channel if any
  const oldMessages = await rest.get(Routes.channelMessages(CHANNEL_ID), { query: new URLSearchParams({ limit: '10' }) });
  console.log('Found existing messages:', oldMessages.length);
  for (const msg of oldMessages) {
    await rest.delete(Routes.channelMessage(CHANNEL_ID, msg.id)).catch(() => {});
    console.log('Deleted old message:', msg.id);
  }

  // Send message
  const payload = {
    embeds: [embed],
    components: [], // NO buttons!
  };

  const message = await rest.post(Routes.channelMessages(CHANNEL_ID), {
    body: payload,
    files: files.length > 0 ? files : undefined,
  });

  console.log('Verification panel sent! Message ID:', message.id);

  // React with ✅
  const emoji = encodeURIComponent('✅');
  await rest.put(Routes.channelMessageOwnReaction(CHANNEL_ID, message.id, emoji));
  console.log('Auto-reacted with ✅ on message:', message.id);

  // Update verification.json
  const vPath = path.resolve(__dirname, '..', 'data', 'verification.json');
  let vData = {};
  if (fs.existsSync(vPath)) {
    vData = JSON.parse(fs.readFileSync(vPath, 'utf8'));
  }
  vData[GUILD_ID] = {
    guildId: GUILD_ID,
    enabled: true,
    channelId: CHANNEL_ID,
    messageId: message.id,
    mode: 'reaction',
    reactionEmoji: '✅',
    roleId: '1569012828394754058',       // Verified role
    unverifiedRoleId: '1569012942744195314', // Unverified role
    logChannelId: '1569042414474231988',     // log-channel-verify
    waitMinutes: 0,
    bannerUrl: null,
    title: '🔐 SERVER VERIFICATION',
    description: embed.description,
    buttonLabel: 'Verify',
    updatedAt: Date.now(),
  };

  fs.writeFileSync(vPath, JSON.stringify(vData, null, 2), 'utf8');
  console.log('Updated verification.json successfully!');
}

main().catch(console.error);
