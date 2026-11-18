import fs from "fs";
import path from "path";
import { Client, TextChannel } from "discord.js";

export interface PendingChatWelcome {
  messageId: string;
  channelId: string;
  guildId: string;
  deleteAt: number;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const PENDING_FILE = path.join(DATA_DIR, "pendingChatWelcomes.json");

// In-memory debounce to prevent double-welcome spam within 60 seconds
const recentWelcomeUsers = new Map<string, number>();

// Active in-memory timers: messageId -> Timeout
const activeTimers = new Map<string, NodeJS.Timeout>();

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadPending(): PendingChatWelcome[] {
  try {
    ensureDir();
    if (!fs.existsSync(PENDING_FILE)) return [];
    const raw = fs.readFileSync(PENDING_FILE, "utf8").trim();
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error("[chatWelcomeCleaner:load:error]", err);
    return [];
  }
}

function savePending(list: PendingChatWelcome[]): void {
  try {
    ensureDir();
    fs.writeFileSync(PENDING_FILE, JSON.stringify(list, null, 2), "utf8");
  } catch (err) {
    console.error("[chatWelcomeCleaner:save:error]", err);
  }
}

/**
 * Checks if a member was already welcomed in chat within the last 60 seconds.
 */
export function isRecentChatWelcome(memberId: string): boolean {
  const lastTime = recentWelcomeUsers.get(memberId);
  if (!lastTime) return false;
  return Date.now() - lastTime < 60_000;
}

/**
 * Marks a member as recently welcomed in chat.
 */
export function markChatWelcomeSent(memberId: string): void {
  recentWelcomeUsers.set(memberId, Date.now());
  // Prune old entries
  const now = Date.now();
  for (const [id, time] of recentWelcomeUsers.entries()) {
    if (now - time > 120_000) {
      recentWelcomeUsers.delete(id);
    }
  }
}

/**
 * Schedules auto-deletion for a chat welcome message.
 */
export function scheduleChatWelcomeDeletion(
  client: Client,
  messageId: string,
  channelId: string,
  guildId: string,
  delayMs: number
): void {
  const deleteAt = Date.now() + delayMs;
  const list = loadPending().filter((p) => p.messageId !== messageId);
  list.push({ messageId, channelId, guildId, deleteAt });
  savePending(list);

  // Clear existing timer if any
  const existingTimer = activeTimers.get(messageId);
  if (existingTimer) clearTimeout(existingTimer);

  const timer = setTimeout(async () => {
    activeTimers.delete(messageId);
    await deleteMessage(client, channelId, messageId);
    const updated = loadPending().filter((p) => p.messageId !== messageId);
    savePending(updated);
  }, Math.max(1000, delayMs));

  activeTimers.set(messageId, timer);
  console.log(
    `[chatWelcomeCleaner] Scheduled auto-deletion for message ${messageId} in ${Math.round(
      delayMs / 60000
    )} minutes`
  );
}

async function deleteMessage(
  client: Client,
  channelId: string,
  messageId: string
): Promise<void> {
  try {
    const channel = (await client.channels
      .fetch(channelId)
      .catch(() => null)) as TextChannel | null;
    if (channel && channel.isTextBased()) {
      const msg = await channel.messages.fetch(messageId).catch(() => null);
      if (msg) {
        await msg.delete().catch(() => {});
        console.log(
          `[chatWelcomeCleaner] Auto-deleted expired chat welcome card (${messageId}) from #${channel.name}`
        );
      }
    }
  } catch (err: any) {
    console.warn(`[chatWelcomeCleaner] Could not delete message ${messageId}:`, err.message);
  }
}

/**
 * Initializes the chat welcome cleaner on bot startup.
 * Immediately purges overdue messages and resumes timers for the rest.
 */
export function initChatWelcomeCleaner(client: Client): void {
  const list = loadPending();
  if (list.length === 0) return;

  const now = Date.now();
  const remaining: PendingChatWelcome[] = [];

  for (const item of list) {
    if (item.deleteAt <= now) {
      // Overdue: delete immediately
      void deleteMessage(client, item.channelId, item.messageId);
    } else {
      // Still active: schedule remaining time
      remaining.push(item);
      const delay = item.deleteAt - now;
      const timer = setTimeout(async () => {
        activeTimers.delete(item.messageId);
        await deleteMessage(client, item.channelId, item.messageId);
        const updated = loadPending().filter((p) => p.messageId !== item.messageId);
        savePending(updated);
      }, delay);
      activeTimers.set(item.messageId, timer);
    }
  }

  savePending(remaining);
  console.log(
    `[chatWelcomeCleaner] Initialized cleaner. Resumed ${remaining.length} timer(s), purged ${
      list.length - remaining.length
    } overdue message(s).`
  );
}
