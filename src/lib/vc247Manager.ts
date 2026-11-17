import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  VoiceConnection,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
} from "@discordjs/voice";
import {
  ChannelType,
  EmbedBuilder,
  Guild,
  Message,
  PermissionFlagsBits,
  VoiceBasedChannel,
  VoiceState,
} from "discord.js";
import { Readable } from "stream";
import {
  getAllVc247Configs,
  getVc247Config,
  updateVc247Config,
} from "./vc247Store";
import { BRAND } from "./brand";
import { hasFeaturePermission } from "./permissionRolesStore";
import { VyntricClient } from "../structures/VyntricClient";

// Active 24/7 Voice Connections: guildId -> VoiceConnection
const activeConnections = new Map<string, VoiceConnection>();
const reconnectTimers = new Map<string, NodeJS.Timeout>();

/**
 * Creates an endless silent audio stream to keep Discord voice handshake alive.
 */
class SilenceStream extends Readable {
  _read() {
    // 5 zero bytes Opus silence frame every 20ms
    this.push(Buffer.from([0xf8, 0xff, 0xfe]));
  }
}

/**
 * Joins a voice channel in 24/7 mode and maintains persistent connection.
 */
export async function joinVc247(
  guild: Guild,
  channelId: string,
  initiatorTag?: string
): Promise<{ success: boolean; channelName: string; error?: string }> {
  const channel = guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null));
  if (!channel || !channel.isVoiceBased()) {
    return { success: false, channelName: "Unknown", error: "Target channel is not a valid Voice Channel." };
  }

  // Clear any pending reconnect timers
  const pendingTimer = reconnectTimers.get(guild.id);
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    reconnectTimers.delete(guild.id);
  }

  try {
    let connection = getVoiceConnection(guild.id);
    if (!connection || connection.state.status === VoiceConnectionStatus.Destroyed) {
      connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true,
        selfMute: true,
      });
    }

    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);

    // Keep-alive dummy player
    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play,
      },
    });

    try {
      const resource = createAudioResource(new SilenceStream());
      player.play(resource);
      connection.subscribe(player);
    } catch {
      // Audio resource creation optional
    }

    activeConnections.set(guild.id, connection);

    // Connection lifecycle handlers
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      console.warn(`[vc247:${guild.name}] Disconnected. Attempting auto-reconnect...`);
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        // If reconnect failed, schedule hard join
        scheduleAutoReconnect(guild, channel.id);
      }
    });

    connection.on(VoiceConnectionStatus.Destroyed, () => {
      activeConnections.delete(guild.id);
      const cfg = getVc247Config(guild.id);
      if (cfg.enabled && cfg.autoReconnect) {
        scheduleAutoReconnect(guild, channel.id);
      }
    });

    updateVc247Config(guild.id, (prev) => ({
      ...prev,
      enabled: true,
      channelId: channel.id,
      connectedAt: Date.now(),
      reconnectCount: 0,
    }));

    console.log(`[vc247] Connected 24/7 to #${channel.name} in ${guild.name} (initiated by ${initiatorTag || "System"})`);
    return { success: true, channelName: channel.name };
  } catch (err: any) {
    console.error(`[vc247:error] Failed to connect to #${channel.name}:`, err.message);
    return { success: false, channelName: channel.name, error: err.message };
  }
}

/**
 * Schedules an auto-reconnect with backoff.
 */
function scheduleAutoReconnect(guild: Guild, channelId: string) {
  if (reconnectTimers.has(guild.id)) return;

  const timer = setTimeout(async () => {
    reconnectTimers.delete(guild.id);
    const cfg = getVc247Config(guild.id);
    if (!cfg.enabled) return;

    console.log(`[vc247:${guild.name}] Reconnecting to designated 24/7 channel ${channelId}...`);
    updateVc247Config(guild.id, (prev) => ({ ...prev, reconnectCount: (prev.reconnectCount || 0) + 1 }));
    await joinVc247(guild, channelId, "24/7 Auto-Reconnect Engine");
  }, 4_000);

  reconnectTimers.set(guild.id, timer);
}

/**
 * Leaves 24/7 voice channel and deactivates persistent mode.
 */
export async function leaveVc247(guild: Guild): Promise<{ success: boolean; channelName?: string }> {
  const cfg = getVc247Config(guild.id);
  const pendingTimer = reconnectTimers.get(guild.id);
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    reconnectTimers.delete(guild.id);
  }

  const connection = getVoiceConnection(guild.id) || activeConnections.get(guild.id);
  let oldName: string | undefined;

  if (cfg.channelId) {
    const ch = guild.channels.cache.get(cfg.channelId);
    if (ch) oldName = ch.name;
  }

  if (connection) {
    try {
      connection.destroy();
    } catch {}
    activeConnections.delete(guild.id);
  }

  updateVc247Config(guild.id, (prev) => ({
    ...prev,
    enabled: false,
    channelId: null,
    connectedAt: null,
  }));

  console.log(`[vc247] Left 24/7 voice channel in ${guild.name}`);
  return { success: true, channelName: oldName };
}

/**
 * Resumes and connects all configured 24/7 voice channels upon bot boot.
 */
export async function syncAllVc247(client: VyntricClient): Promise<void> {
  const configs = getAllVc247Configs();
  for (const [guildId, cfg] of Object.entries(configs)) {
    if (cfg.enabled && cfg.channelId) {
      try {
        const guild = client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId).catch(() => null));
        if (guild) {
          const ch = guild.channels.cache.get(cfg.channelId) || (await guild.channels.fetch(cfg.channelId).catch(() => null));
          if (ch && ch.isVoiceBased()) {
            console.log(`[vc247:boot] Resuming 24/7 presence in ${guild.name} -> #${ch.name}...`);
            await joinVc247(guild, cfg.channelId, "Boot Synchronizer");
          }
        }
      } catch (err: any) {
        console.error(`[vc247:boot:error] Guild ${guildId}:`, err.message);
      }
    }
  }
}

/**
 * Handles bot's own voice state changes: prevents disconnects and enforces 24/7 channel lock.
 */
export async function handleBotVoiceState(
  oldState: VoiceState,
  newState: VoiceState,
  client: VyntricClient
): Promise<void> {
  if (newState.id !== client.user?.id) return;

  const guild = newState.guild || oldState.guild;
  if (!guild) return;

  const cfg = getVc247Config(guild.id);
  if (!cfg.enabled || !cfg.channelId) return;

  // 1. Bot was disconnected from voice while 24/7 mode is active
  if (oldState.channelId && !newState.channelId) {
    console.warn(`[vc247:${guild.name}] Bot was disconnected from VC while 24/7 is enabled! Auto-reconnecting in 2s...`);
    scheduleAutoReconnect(guild, cfg.channelId);
    return;
  }

  // 2. Bot was moved to another channel instead of the designated 24/7 channel
  if (newState.channelId && newState.channelId !== cfg.channelId) {
    console.warn(`[vc247:${guild.name}] Bot was moved to #${newState.channel?.name}. Re-routing to designated 24/7 channel #${cfg.channelId}...`);
    setTimeout(async () => {
      await joinVc247(guild, cfg.channelId!, "24/7 Channel Lock Guardian");
    }, 2000);
  }
}

/**
 * Handles text-based 24/7 voice commands: 247, .247, joinvc, leavevc
 */
export async function handleVc247TextCommand(message: Message): Promise<boolean> {
  if (!message.guild || message.author.bot) return false;
  const raw = message.content.trim();
  if (raw.length < 3) return false;

  const match = raw.match(/^([!?.+\-$&;]?)(24\/7|247|joinvc|leavevc)(?:\s+([\s\S]*))?$/i);
  if (!match) return false;

  const cmd = match[2].toLowerCase();
  const args = (match[3] || "").trim().toLowerCase();

  const member =
    message.member ||
    (await message.guild.members.fetch(message.author.id).catch(() => null));

  if (
    !member ||
    (!member.permissions.has(PermissionFlagsBits.ManageGuild) &&
      !member.permissions.has(PermissionFlagsBits.ManageChannels) &&
      !member.permissions.has(PermissionFlagsBits.Administrator) &&
      !hasFeaturePermission(member, "vcmod") &&
      !hasFeaturePermission(member, "security"))
  ) {
    return false;
  }

  // Handle leave / disconnect
  if (cmd === "leavevc" || args === "off" || args === "leave" || args === "stop") {
    const res = await leaveVc247(message.guild);
    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.neutral)
      .setTitle("🚪 24/7 Voice Mode Deactivated")
      .setDescription(
        `**${BRAND.name}** has disconnected${res.channelName ? ` from **#${res.channelName}**` : ""}.\n` +
          `24/7 persistent voice presence is now disabled.`
      )
      .setFooter({ text: BRAND.footer })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
    return true;
  }

  // Handle status
  if (args === "status") {
    const status = getVc247Status(message.guild);
    const isOnline = status.enabled && status.connectionStatus === "ready";
    const embed = new EmbedBuilder()
      .setColor(isOnline ? BRAND.colors.success : BRAND.colors.neutral)
      .setTitle(`🎙️ ${BRAND.name} 24/7 Voice Channel Presence`)
      .setDescription(
        `• **Mode:** ${status.enabled ? "🟢 **ENABLED (24/7 ACTIVE)**" : "🔴 **DISABLED**"}\n` +
          `• **Connection:** \`${status.connectionStatus.toUpperCase()}\`\n` +
          `• **Channel:** ${status.channelId ? `<#${status.channelId}> (\`${status.channelName}\`)` : "_None_"}\n` +
          `• **Uptime:** \`${status.uptimeText}\`\n` +
          `• **Auto-Reconnects:** \`${status.reconnects}\`\n` +
          `• **Persistence:** Automatically reconnects on bot boot or network disconnects.`
      )
      .setFooter({ text: `${BRAND.footer} • 24/7 Voice Presence` })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
    return true;
  }

  // Handle join / 247 on
  let targetChannel = member.voice.channel;
  if (!targetChannel) {
    // Check if channel ID or mention was provided in args
    const idMatch = args.match(/\d{17,20}/);
    if (idMatch) {
      const ch = message.guild.channels.cache.get(idMatch[0]);
      if (ch && ch.isVoiceBased()) targetChannel = ch as VoiceBasedChannel;
    }
  }

  if (!targetChannel) {
    await message.reply({
      content: "⚠️ You must either be connected to a voice channel or specify a voice channel ID.",
    });
    return true;
  }

  const res = await joinVc247(message.guild, targetChannel.id, message.author.tag);
  if (!res.success) {
    await message.reply({
      content: `❌ Could not connect to **#${res.channelName}**: ${res.error}`,
    });
    return true;
  }

  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.success)
    .setTitle("🎙️ 24/7 Voice Presence Activated")
    .setDescription(
      `**${BRAND.name}** is now connected to <#${targetChannel.id}> and will stay **24/7**!\n\n` +
        `• **Target Channel:** <#${targetChannel.id}>\n` +
        `• **Auto-Reconnect:** Active\n` +
        `• **Self-Deafen & Mute:** Active (Optimized performance)`
    )
    .setFooter({ text: `${BRAND.footer} • 24/7 Persistent Voice` })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
  return true;
}

/**
 * Returns formatted status data for 24/7 presence.
 */
export function getVc247Status(guild: Guild): {
  enabled: boolean;
  channelId: string | null;
  channelName: string;
  uptimeText: string;
  reconnects: number;
  connectionStatus: string;
} {
  const cfg = getVc247Config(guild.id);
  let channelName = "None";
  if (cfg.channelId) {
    const ch = guild.channels.cache.get(cfg.channelId);
    if (ch) channelName = ch.name;
  }

  let uptimeText = "Offline";
  if (cfg.enabled && cfg.connectedAt) {
    const elapsedSeconds = Math.floor((Date.now() - cfg.connectedAt) / 1000);
    const hours = Math.floor(elapsedSeconds / 3600);
    const mins = Math.floor((elapsedSeconds % 3600) / 60);
    const secs = elapsedSeconds % 60;
    uptimeText = `${hours}h ${mins}m ${secs}s`;
  }

  const conn = getVoiceConnection(guild.id);
  const status = conn ? conn.state.status : "disconnected";

  return {
    enabled: cfg.enabled,
    channelId: cfg.channelId,
    channelName,
    uptimeText,
    reconnects: cfg.reconnectCount || 0,
    connectionStatus: status,
  };
}
