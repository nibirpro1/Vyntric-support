import { ActivityType, Events } from "discord.js";
import { VyntricClient } from "../structures/VyntricClient";
import { BRAND, setBrandAssets } from "../lib/brand";
import { initDateChannelSync } from "../lib/dateChannelStore";

export default {
  // `clientReady` is the v15-safe name for the old `ready` event.
  name: Events.ClientReady,
  once: true,
  async execute(client: VyntricClient) {
    console.log(`[INFO] ${BRAND.name} is online as ${client.user?.tag}`);
    console.log(`[INFO] Serving ${client.guilds.cache.size} guild(s).`);

    // The bot avatar (your Vyntric logo) is reused as the icon on every embed.
    setBrandAssets({ icon: client.user?.displayAvatarURL({ size: 256 }) });

    client.user?.setPresence({
      status: "online",
      activities: [{ name: "Plugsy • /play • /panel", type: ActivityType.Listening }],
    });

    // Attempt to update username to Plugsy if not already set
    if (client.user && client.user.username !== "Plugsy") {
      client.user.setUsername("Plugsy").catch(() => {
        /* Rate-limited by Discord or requires manual change in dev portal */
      });
    }

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
