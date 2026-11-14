import fs from "fs";
import path from "path";
import { ActivityType, Events } from "discord.js";
import { VyntricClient } from "../structures/VyntricClient";
import { BRAND, setBrandAssets } from "../lib/brand";
import { initDateChannelSync } from "../lib/dateChannelStore";

const AVATAR_PATH = path.resolve(process.cwd(), "assets", "vyntric-avatar.jpg");

export default {
  // `clientReady` is the v15-safe name for the old `ready` event.
  name: Events.ClientReady,
  once: true,
  async execute(client: VyntricClient) {
    console.log(`[INFO] ${BRAND.name} is online as ${client.user?.tag}`);
    console.log(`[INFO] Serving ${client.guilds.cache.size} guild(s).`);

    // 1. Update bot Avatar to the new official Vyntric logo
    if (client.user && fs.existsSync(AVATAR_PATH)) {
      try {
        const avatarBuffer = fs.readFileSync(AVATAR_PATH);
        await client.user.setAvatar(avatarBuffer);
        console.log("[ready:avatar] Successfully updated bot avatar to Vyntric official logo.");
      } catch (err: any) {
        console.warn("[ready:avatar] Could not update avatar (rate-limited by Discord or recently changed):", err.message);
      }
    }

    // 2. Update bot Global Username to Vyntric
    if (client.user && client.user.username !== "Vyntric") {
      client.user.setUsername("Vyntric").then(() => {
        console.log("[ready:username] Successfully changed username to Vyntric.");
      }).catch((err: any) => {
        console.warn("[ready:username] Could not set global username (may be rate-limited or taken):", err.message);
      });
    }

    // 3. Update Guild Nickname and check Bot roles
    for (const guild of client.guilds.cache.values()) {
      try {
        const me = guild.members.me || (await guild.members.fetchMe().catch(() => null));
        if (me) {
          console.log(`[ready] Bot ${client.user?.tag} in ${guild.name} (ID: ${guild.id}) - Nickname: '${me.nickname}', Roles: [${me.roles.cache.map(r => r.name).join(", ")}]`);
          if (me.nickname !== "Vyntric" && me.manageable) {
            await me.setNickname("Vyntric");
            console.log(`[ready:nickname] Set server nickname to 'Vyntric' in ${guild.name}`);
          }

          // Check if there is a bot role (e.g. "Bot", "Bots", "BOTS", etc.)
          const botRole = guild.roles.cache.find(r =>
            (r.name.toLowerCase() === "bot" || r.name.toLowerCase() === "bots" || r.name.toLowerCase().includes("bot")) &&
            !r.managed
          );
          if (botRole) {
            if (!me.roles.cache.has(botRole.id) && botRole.editable) {
              await me.roles.add(botRole, "Ensure bot has Bot role").catch(() => {});
              console.log(`[ready:roles] Added role '${botRole.name}' to Vyntric bot.`);
            }
            if (!botRole.hoist && botRole.editable) {
              await botRole.setHoist(true, "Display Bot separately in member sidebar").catch(() => {});
              console.log(`[ready:roles] Hoisted '${botRole.name}' role so it displays in member sidebar.`);
            }
          }
        }
      } catch (err: any) {
        console.warn(`[ready:nickname] Could not set nickname in ${guild.name}:`, err.message);
      }
    }

    // Set brand icon asset to live avatar
    setBrandAssets({ icon: client.user?.displayAvatarURL({ size: 256 }) });

    client.user?.setPresence({
      status: "online",
      activities: [{ name: "🛡️ /help • Vyntric Security", type: ActivityType.Watching }],
    });

    // Initialize active giveaways and resume timers
    try {
      const { initGiveaways } = require("../lib/giveawayManager");
      initGiveaways(client);
    } catch (err) {
      console.error("[giveaways:init:error]", err);
    }

    // Initialize automated live date channel
    try {
      initDateChannelSync(client);
    } catch (err) {
      console.error("[dateChannel:init:error]", err);
    }
  },
};
