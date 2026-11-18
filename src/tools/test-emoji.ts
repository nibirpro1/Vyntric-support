import dotenv from "dotenv";
dotenv.config();
import { Client, GatewayIntentBits, ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN);

  try {
    const btn = new ButtonBuilder()
      .setCustomId("test_btn")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji({ id: "1161605686568960060", name: "name" });
    console.log("Button created successfully with custom emoji object!");
  } catch (err) {
    console.error("Failed to build button:", err);
  }

  await client.destroy();
}
main();
