import "dotenv/config";
import net from "net";
import { ActivityType, GatewayIntentBits, Partials } from "discord.js";
import { VyntricClient } from "./structures/VyntricClient";
import { loadCommands } from "./handlers/loadCommands";
import { loadEvents } from "./handlers/loadEvents";
import { flushStore } from "./lib/store";
import { BRAND } from "./lib/brand";

// Single-instance lock: prevents duplicate bots from running at the same time
const LOCK_PORT = 39482;
const lockServer = net.createServer();
lockServer.once("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `[FATAL] Another instance of ${BRAND.name} is already running! Exiting to prevent duplicate responses.`
    );
    process.exit(1);
  }
});
lockServer.listen(LOCK_PORT, "127.0.0.1");

const client = new VyntricClient({
  presence: {
    status: "online",
    activities: [{ name: "🛡️ Vyntric • /help", type: ActivityType.Watching }],
  },
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildWebhooks,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.Reaction,
    Partials.User,
    Partials.GuildMember,
  ],
});

process.on("unhandledRejection", (reason) => console.error("[unhandledRejection]", reason));
process.on("uncaughtException", (err: any) => {
  console.error("[uncaughtException]", err);
  if (err?.message?.includes("handshake has timed out") || !client.isReady()) {
    console.error("[FATAL] Gateway handshake or startup failure. Exiting for clean runner restart...");
    process.exit(1);
  }
});

client.on("error", (err) => {
  console.error("[client:error]", err.message);
});

client.on("shardError", (err, shardId) => {
  console.warn(`[WARN] Shard ${shardId} websocket error:`, err.message);
});

if (!process.env.DISCORD_TOKEN) {
  console.error(
    "[FATAL] DISCORD_TOKEN is missing. Copy .env.example to .env and paste your bot token."
  );
  process.exit(1);
}

loadCommands(client);
loadEvents(client);

let shuttingDown = false;
const shutdown = (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[INFO] Received ${signal} — saving data and shutting down.`);
  flushStore();
  client.destroy();
};

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

console.log(`[INFO] Starting ${BRAND.name}…`);

client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error("[FATAL] Discord login failed — check DISCORD_TOKEN and bot intents.", err);
  process.exit(1);
});

// Keep process active indefinitely
setInterval(() => {}, 1000 * 60 * 60);


// Keep process active indefinitely
setInterval(() => {}, 1000 * 60 * 60);

