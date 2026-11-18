import dotenv from "dotenv";
dotenv.config();
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  TextChannel,
} from "discord.js";

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN);
  const guild = await client.guilds.fetch("1507706011622965258");
  const channel = (await guild.channels.fetch("1572303634178248946")) as TextChannel;

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("voice_rename_button").setStyle(ButtonStyle.Secondary).setEmoji({ id: "1161605686568960060", name: "name" }),
    new ButtonBuilder().setCustomId("voice_limit_button").setStyle(ButtonStyle.Secondary).setEmoji({ id: "1161605683955900496", name: "limit" }),
    new ButtonBuilder().setCustomId("voice_privacy_button").setStyle(ButtonStyle.Secondary).setEmoji({ id: "1161605685201612840", name: "lock" }),
    new ButtonBuilder().setCustomId("voice_waiting_button").setStyle(ButtonStyle.Secondary).setEmoji({ id: "1161605871227387965", name: "waiting" }),
    new ButtonBuilder().setCustomId("voice_thread_button").setStyle(ButtonStyle.Secondary).setEmoji({ id: "1427941772163682408", name: "chat" })
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("voice_trust_button").setStyle(ButtonStyle.Secondary).setEmoji({ id: "1161647139244490832", name: "trust" }),
    new ButtonBuilder().setCustomId("voice_untrust_button").setStyle(ButtonStyle.Secondary).setEmoji({ id: "1162862846007320668", name: "untrust" }),
    new ButtonBuilder().setCustomId("voice_invite_button").setStyle(ButtonStyle.Secondary).setEmoji({ id: "1161647152821444688", name: "invite" }),
    new ButtonBuilder().setCustomId("voice_kick_button").setStyle(ButtonStyle.Secondary).setEmoji({ id: "1161605681107976263", name: "kick" }),
    new ButtonBuilder().setCustomId("voice_region_button").setStyle(ButtonStyle.Secondary).setEmoji({ id: "1161605689576263753", name: "region" })
  );

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("voice_block_button").setStyle(ButtonStyle.Secondary).setEmoji({ id: "1161605864898174986", name: "block" }),
    new ButtonBuilder().setCustomId("voice_unblock_button").setStyle(ButtonStyle.Secondary).setEmoji({ id: "1162862844585443370", name: "unblock" }),
    new ButtonBuilder().setCustomId("voice_claim_button").setStyle(ButtonStyle.Secondary).setEmoji({ id: "1161605458054889472", name: "claim" }),
    new ButtonBuilder().setCustomId("voice_transfer_button").setStyle(ButtonStyle.Secondary).setEmoji({ id: "1161647167488929963", name: "transfer" }),
    new ButtonBuilder().setCustomId("voice_close_button").setStyle(ButtonStyle.Secondary).setEmoji({ id: "1161605459292205076", name: "delete" })
  );

  console.log("All 3 ActionRows built!");
  await client.destroy();
}
main().catch(console.error);
