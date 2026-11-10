const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

const GUILD_ID = '1507706011622965258';
const CHANNEL_ID = '1560933139134545950'; // # 〢verify
const BANNER_PATH = path.resolve(__dirname, '..', 'assets', 'banners', 'vyntric-verify.png');

async function main() {
  console.log('Posting concise verification panel to channel:', CHANNEL_ID);

  const bannerExists = fs.existsSync(BANNER_PATH);

  const shortDescription =
    `Welcome to **Vyntric**!\n` +
    `React with the **✅** emoji below to verify and unlock full access.`;

  const embed = {
    title: '🔐 SERVER VERIFICATION',
    color: 0xb1121f, // Crimson Red
    description: shortDescription,
    footer: {
      text: 'Plugsy Security • React with ✅ below',
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

  // Clear old messages in verify channel
  const oldMessages = await rest.get(Routes.channelMessages(CHANNEL_ID), { query: new URLSearchParams({ limit: '10' }) });
  for (const msg of oldMessages) {
    await rest.delete(Routes.channelMessage(CHANNEL_ID, msg.id)).catch(() => {});
  }

  // Send concise message
  const payload = {
    embeds: [embed],
    components: [], // NO buttons!
  };

  const message = await rest.post(Routes.channelMessages(CHANNEL_ID), {
    body: payload,
    files: files.length > 0 ? files : undefined,
  });

  console.log('Concise verification panel sent! Message ID:', message.id);

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
    description: shortDescription,
    buttonLabel: 'Verify',
    updatedAt: Date.now(),
  };

  fs.writeFileSync(vPath, JSON.stringify(vData, null, 2), 'utf8');
  console.log('Updated verification.json successfully!');
}

main().catch(console.error);
