import fs from "fs";
import path from "path";
import { GuildMember } from "discord.js";

export interface WelcomeConfig {
  guildId: string;
  enabled: boolean;
  channelId: string | null;
  message: string;
  bannerUrl?: string | null;
  autoRoleIds: string[];
  dmEnabled: boolean;
  dmMessage: string;
  leaveChannelId: string | null;
  leaveMessage: string;
  updatedAt: number;
  // General chat greeting card (sent to #chat when someone joins)
  chatWelcomeEnabled?: boolean;
  chatWelcomeChannelId?: string | null;
  chatWelcomePing?: string;
  chatWelcomeTitle?: string;
  chatWelcomeDescription?: string;
  chatWelcomeBannerUrl?: string | null;
}

const DEFAULT_CHAT_DESCRIPTION =
  "🌸 Enjoy fun moments, make new friends..!\n" +
  "Play together in a positive & active gaming community. 🔥\n\n" +
  "» Don't forget to:\n" +
  "  » Check our rules in <#1554018991759032320> and get roles in <#1551792726243287130>\n" +
  "  » Chat and hang out right here in <#1560688449353420930> ⚡";

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");
const WELCOME_FILE = path.join(DATA_DIR, "welcome.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): Record<string, WelcomeConfig> {
  try {
    ensureDir();
    if (!fs.existsSync(WELCOME_FILE)) return {};
    const raw = fs.readFileSync(WELCOME_FILE, "utf8").trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.error("[welcomeStore] Read error:", err);
    return {};
  }
}

let store: Record<string, WelcomeConfig> = readStore();

function persist() {
  try {
    ensureDir();
    const tmp = `${WELCOME_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
    fs.renameSync(tmp, WELCOME_FILE);
  } catch (err) {
    console.error("[welcomeStore] Save error:", err);
  }
}

export function getWelcomeConfig(guildId: string): WelcomeConfig {
  if (!store[guildId]) {
    store[guildId] = {
      guildId,
      enabled: false,
      channelId: null,
      message: "👋 Welcome {user} to **{server}**! You are our **#{memberCount}** member. Enjoy your stay!",
      bannerUrl: null,
      autoRoleIds: [],
      dmEnabled: false,
      dmMessage: "Welcome to **{server}**, {user}! Make sure to read our rules and have fun!",
      leaveChannelId: null,
      leaveMessage: "👋 **{username}** has left **{server}**. We now have **{memberCount}** members.",
      chatWelcomeEnabled: true,
      chatWelcomeChannelId: "1560688449353420930", // #〢ᴄʜᴀᴛ
      chatWelcomePing: "💜 Yoo, {user}",
      chatWelcomeTitle: "Welcome to {server}",
      chatWelcomeDescription: DEFAULT_CHAT_DESCRIPTION,
      chatWelcomeBannerUrl: null,
      updatedAt: Date.now(),
    };
  } else {
    // Fill in default chat welcome values if undefined
    const cfg = store[guildId];
    if (cfg.chatWelcomeEnabled === undefined) cfg.chatWelcomeEnabled = true;
    if (!cfg.chatWelcomeChannelId) cfg.chatWelcomeChannelId = "1560688449353420930";
    if (!cfg.chatWelcomePing) cfg.chatWelcomePing = "💜 Yoo, {user}";
    if (!cfg.chatWelcomeTitle) cfg.chatWelcomeTitle = "Welcome to {server}";
    if (!cfg.chatWelcomeDescription) cfg.chatWelcomeDescription = DEFAULT_CHAT_DESCRIPTION;
  }
  return store[guildId];
}

export function updateWelcomeConfig(
  guildId: string,
  updates: Partial<WelcomeConfig>
): WelcomeConfig {
  const current = getWelcomeConfig(guildId);
  const updated: WelcomeConfig = {
    ...current,
    ...updates,
    updatedAt: Date.now(),
  };
  store[guildId] = updated;
  persist();
  return updated;
}

export const WELCOME_JOKES = [
  "⚠️ Warning: Don't feed the staff after midnight! 🍕",
  "👟 Please leave your shoes and your sanity at the door.",
  "👀 A wild member has appeared! Quick, throw a Pokéball!",
  "🍿 Grab some popcorn and prepare for pure entertainment.",
  "🤫 The mods don't bite... usually.",
  "🚀 Houston, we have a new legend on board!",
  "🍕 You brought snacks for the whole server, right?",
  "💡 Pro tip: Reading rules gives you +100 aura.",
  "🥳 We were expecting you! Make yourself at home.",
  "🛡️ You survived the outside internet. Welcome to Vyntric!",
  "☕ Grab some tea, sit back, and enjoy the community vibes.",
];

export function getRandomWelcomeJoke(): string {
  return WELCOME_JOKES[Math.floor(Math.random() * WELCOME_JOKES.length)];
}

export function formatWelcomeText(template: string, memberOrUser: any): string {
  if (!template) return "";
  const member = memberOrUser;
  const count = member?.guild?.memberCount?.toString() || "1";
  const username = member?.user?.username || member?.username || "Member";
  const id = member?.id || member?.user?.id || "0";
  const guildName = member?.guild?.name || "Server";

  return template
    .replace(/{user}/g, `<@${id}>`)
    .replace(/{username}/g, username)
    .replace(/{server}/g, guildName)
    .replace(/{memberCount}/g, count);
}
