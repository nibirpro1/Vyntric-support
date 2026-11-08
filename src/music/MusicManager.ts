import {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  StreamType,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  Guild,
  Message,
  MessageFlags,
  VoiceBasedChannel,
} from "discord.js";
import path from "path";
import fs from "fs";
import { spawn, execFile } from "child_process";
import ffmpegStatic from "ffmpeg-static";
const ytSearch = require("yt-search");
import { GuildQueue, LoopMode, Track } from "./types";
import { BRAND } from "../lib/brand";

if (ffmpegStatic) {
  process.env.FFMPEG_PATH = ffmpegStatic;
}

const LOCAL_YTDLP = path.resolve(process.cwd(), "bin", "yt-dlp.exe");
const YTDLP_BIN = fs.existsSync(LOCAL_YTDLP) ? LOCAL_YTDLP : "yt-dlp";

function formatSeconds(secs: number): string {
  if (isNaN(secs) || secs <= 0) return "00:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const h = Math.floor(m / 60);
  const remM = m % 60;
  if (h > 0) {
    return `${h}:${remM.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function createProgressBar(currentSec: number, totalSec: number, length = 15): string {
  if (!totalSec || totalSec <= 0) return "🔘" + "▬".repeat(length - 1);
  const progress = Math.min(Math.max(currentSec / totalSec, 0), 1);
  const filled = Math.round(progress * length);
  const bar = Array.from({ length }, (_, i) => (i === filled ? "🔘" : "▬")).join("");
  return `${bar} \`[${formatSeconds(currentSec)} / ${formatSeconds(totalSec)}]\``;
}

function getYtDlpMetadata(urlOrQuery: string): Promise<any> {
  return new Promise((resolve) => {
    execFile(
      YTDLP_BIN,
      ["--dump-json", "--no-playlist", "--no-warnings", "-q", urlOrQuery],
      { timeout: 15_000, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout) => {
        if (err || !stdout) return resolve(null);
        try {
          const lines = stdout.trim().split("\n").filter(Boolean);
          if (lines.length === 0) return resolve(null);
          const data = JSON.parse(lines[0]);
          resolve(data);
        } catch {
          resolve(null);
        }
      }
    );
  });
}

export class MusicManager {
  private static instance: MusicManager;
  private queues: Map<string, GuildQueue> = new Map();

  private constructor() {}

  public static getInstance(): MusicManager {
    if (!MusicManager.instance) {
      MusicManager.instance = new MusicManager();
    }
    return MusicManager.instance;
  }

  public getQueue(guildId: string): GuildQueue | undefined {
    return this.queues.get(guildId);
  }

  private killStreamProcesses(queue: GuildQueue): void {
    if (queue.streamProcesses && queue.streamProcesses.length > 0) {
      for (const p of queue.streamProcesses) {
        try {
          if (!p.killed) p.kill();
        } catch {}
      }
      queue.streamProcesses = [];
    }
    if (queue.streamProcess) {
      try {
        if (!queue.streamProcess.killed) queue.streamProcess.kill();
      } catch {}
      queue.streamProcess = undefined;
    }
  }

  public async getOrCreateQueue(
    guild: Guild,
    voiceChannel: VoiceBasedChannel,
    textChannel: any
  ): Promise<GuildQueue> {
    let queue = this.queues.get(guild.id);
    if (queue && queue.connection.state.status !== VoiceConnectionStatus.Destroyed) {
      queue.textChannel = textChannel;
      return queue;
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
    } catch (err) {
      connection.destroy();
      throw new Error("Failed to connect to the voice channel within 15 seconds.");
    }

    const player = createAudioPlayer();
    connection.subscribe(player);

    queue = {
      guildId: guild.id,
      voiceChannelId: voiceChannel.id,
      textChannel,
      connection,
      player,
      tracks: [],
      currentTrack: null,
      volume: 80,
      loopMode: "off",
      isPlaying: false,
    };

    this.queues.set(guild.id, queue);

    // Audio player event listeners
    player.on(AudioPlayerStatus.Idle, () => {
      this.handleTrackEnd(guild.id);
    });

    player.on("error", (error) => {
      console.error(`[music:player:${guild.id}] Audio player error:`, error.message);
      this.killStreamProcesses(queue!);
      queue?.textChannel
        .send({
          embeds: [
            new EmbedBuilder()
              .setColor(BRAND.colors.danger)
              .setDescription(`⚠️ **Audio stream error:** ${error.message}. Skipping to next track…`),
          ],
        })
        .catch(() => {});
      this.handleTrackEnd(guild.id);
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.destroyQueue(guild.id);
      }
    });

    return queue;
  }

  private async getPlaylistTracks(
    playlistUrl: string,
    requesterId: string,
    requesterTag: string,
    maxTracks = 50
  ): Promise<Track[]> {
    return new Promise((resolve) => {
      execFile(
        YTDLP_BIN,
        [
          "--flat-playlist",
          "--dump-json",
          "--no-warnings",
          "-q",
          playlistUrl,
        ],
        { timeout: 30_000, maxBuffer: 20 * 1024 * 1024 },
        (err, stdout) => {
          if (err || !stdout) return resolve([]);
          try {
            const lines = stdout.trim().split("\n").filter(Boolean);
            const tracks: Track[] = [];
            for (let i = 0; i < Math.min(lines.length, maxTracks); i++) {
              try {
                const item = JSON.parse(lines[i]);
                const id = item.id || `track_${i}`;
                const title = item.title || "Unknown Title";
                const url = item.url || item.webpage_url || `https://www.youtube.com/watch?v=${id}`;
                const durationSec = Math.round(item.duration || 0);
                tracks.push({
                  id: `yt_${id}`,
                  title,
                  url,
                  durationSeconds: durationSec,
                  durationFormatted: durationSec > 0 ? formatSeconds(durationSec) : "Live / Unknown",
                  thumbnail: item.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
                  author: item.uploader || item.channel || "YouTube Artist",
                  requesterId,
                  requesterTag,
                  platform: "youtube",
                });
              } catch {}
            }
            resolve(tracks);
          } catch {
            resolve([]);
          }
        }
      );
    });
  }

  private async searchYtDlp(
    query: string,
    requesterId: string,
    requesterTag: string
  ): Promise<Track[]> {
    return new Promise((resolve) => {
      execFile(
        YTDLP_BIN,
        [
          "--dump-json",
          "--no-playlist",
          "--no-warnings",
          "-q",
          `ytsearch1:${query}`,
        ],
        { timeout: 15_000, maxBuffer: 10 * 1024 * 1024 },
        (err, stdout) => {
          if (err || !stdout) return resolve([]);
          try {
            const lines = stdout.trim().split("\n").filter(Boolean);
            if (lines.length === 0) return resolve([]);
            const meta = JSON.parse(lines[0]);
            const id = meta.id || `yt_${Date.now()}`;
            const durationSec = Math.round(meta.duration || 0);
            resolve([
              {
                id: `yt_${id}`,
                title: meta.title || query,
                url: meta.webpage_url || `https://www.youtube.com/watch?v=${id}`,
                durationSeconds: durationSec,
                durationFormatted: durationSec > 0 ? formatSeconds(durationSec) : "Live Stream",
                thumbnail: meta.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
                author: meta.uploader || meta.channel || "YouTube Artist",
                requesterId,
                requesterTag,
                platform: "youtube",
              },
            ]);
          } catch {
            resolve([]);
          }
        }
      );
    });
  }

  /**
   * Intelligently resolves user input (YouTube URL, video ID, multiple URLs,
   * playlists, direct audio file stream, or keyword search) into playable Track objects.
   */
  public async search(
    query: string,
    requesterId: string,
    requesterTag: string
  ): Promise<Track[]> {
    const trimmed = query.trim();
    const tracks: Track[] = [];

    // 1. Direct audio file link (.mp3, .wav, .ogg, .aac, .m4a)
    if (/^https?:\/\/.*\.(mp3|wav|ogg|aac|m4a)(\?.*)?$/i.test(trimmed)) {
      const filename = trimmed.split("/").pop()?.split("?")[0] || "Direct Audio Stream";
      tracks.push({
        id: `url_${Date.now()}`,
        title: filename,
        url: trimmed,
        durationSeconds: 0,
        durationFormatted: "Live Stream",
        thumbnail: "https://cdn.discordapp.com/embed/avatars/0.png",
        author: "Web Stream",
        requesterId,
        requesterTag,
        platform: "url",
      });
      return tracks;
    }

    // 2. YouTube Playlist link
    if (/[?&]list=([a-zA-Z0-9_-]+)/i.test(trimmed) && /^https?:\/\//i.test(trimmed)) {
      const playlistTracks = await this.getPlaylistTracks(
        trimmed,
        requesterId,
        requesterTag
      );
      if (playlistTracks.length > 0) {
        return playlistTracks;
      }
    }

    // 3. Extract any YouTube links or 11-char video IDs in the input (handles multiple URLs!)
    const ytRegex =
      /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/gi;
    const matches = [...trimmed.matchAll(ytRegex)];

    if (matches.length > 0) {
      for (const m of matches) {
        const videoId = m[1];
        try {
          const info = await ytSearch({ videoId });
          if (info && info.title) {
            tracks.push({
              id: `yt_${videoId}`,
              title: info.title,
              url: info.url || `https://www.youtube.com/watch?v=${videoId}`,
              durationSeconds: info.duration?.seconds || 0,
              durationFormatted: info.duration?.timestamp || formatSeconds(info.duration?.seconds || 0),
              thumbnail: info.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              author: info.author?.name || "YouTube Creator",
              requesterId,
              requesterTag,
              platform: "youtube",
            });
            continue;
          }
        } catch {
          // If ytSearch fails, try yt-dlp metadata
        }

        // Fallback: yt-dlp metadata lookup
        const meta = await getYtDlpMetadata(`https://www.youtube.com/watch?v=${videoId}`);
        if (meta && meta.title) {
          const dur = Math.round(meta.duration || 0);
          tracks.push({
            id: `yt_${videoId}`,
            title: meta.title,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            durationSeconds: dur,
            durationFormatted: dur > 0 ? formatSeconds(dur) : "Live Stream",
            thumbnail: meta.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            author: meta.channel || meta.uploader || "YouTube Creator",
            requesterId,
            requesterTag,
            platform: "youtube",
          });
        }
      }

      if (tracks.length > 0) {
        return tracks;
      }
    }

    // 4. Other generic web URL (SoundCloud, Vimeo, direct media, etc.)
    if (/^https?:\/\//i.test(trimmed)) {
      const meta = await getYtDlpMetadata(trimmed);
      if (meta && meta.title) {
        const dur = Math.round(meta.duration || 0);
        tracks.push({
          id: `web_${Date.now()}`,
          title: meta.title,
          url: meta.webpage_url || trimmed,
          durationSeconds: dur,
          durationFormatted: dur > 0 ? formatSeconds(dur) : "Live Stream",
          thumbnail: meta.thumbnail || "https://cdn.discordapp.com/embed/avatars/0.png",
          author: meta.uploader || meta.channel || "Web Artist",
          requesterId,
          requesterTag,
          platform: "url",
        });
        return tracks;
      }
    }

    // 5. Keyword Search on YouTube (try yt-search first, fallback to yt-dlp)
    try {
      const searchRes = await ytSearch(trimmed);
      if (searchRes && searchRes.videos && searchRes.videos.length > 0) {
        const top = searchRes.videos[0];
        tracks.push({
          id: `yt_${top.videoId}`,
          title: top.title,
          url: top.url,
          durationSeconds: top.duration?.seconds || 0,
          durationFormatted: top.duration?.timestamp || formatSeconds(top.duration?.seconds || 0),
          thumbnail: top.thumbnail || `https://i.ytimg.com/vi/${top.videoId}/hqdefault.jpg`,
          author: top.author?.name || "YouTube Creator",
          requesterId,
          requesterTag,
          platform: "youtube",
        });
        return tracks;
      }
    } catch (err: any) {
      console.warn(`[music:search:ytSearch] query "${trimmed}" failed, falling back to yt-dlp:`, err?.message || err);
    }

    // Fallback: yt-dlp search
    try {
      const dlpTracks = await this.searchYtDlp(trimmed, requesterId, requesterTag);
      if (dlpTracks.length > 0) {
        return dlpTracks;
      }
    } catch (err: any) {
      console.error("[music:search:ytdlp:error]", err?.message || err);
    }

    return tracks;
  }

  public async playNext(guildId: string): Promise<void> {
    const queue = this.queues.get(guildId);
    if (!queue) return;

    if (queue.idleTimer) {
      clearTimeout(queue.idleTimer);
      queue.idleTimer = undefined;
    }

    this.killStreamProcesses(queue);

    if (queue.tracks.length === 0) {
      queue.currentTrack = null;
      queue.isPlaying = false;
      this.sendQueueEndedEmbed(queue);

      // Auto-disconnect after 3 minutes of inactivity
      queue.idleTimer = setTimeout(() => {
        this.destroyQueue(guildId);
      }, 180_000);
      return;
    }

    const nextTrack = queue.tracks.shift()!;
    queue.currentTrack = nextTrack;
    queue.isPlaying = true;
    queue.playbackStartTime = Date.now();
    queue.pausedAt = undefined;

    try {
      let resource: any;
      const ffmpegBin = ffmpegStatic || "ffmpeg";

      if (nextTrack.platform === "url" && /^https?:\/\/.*\.(mp3|wav|ogg|aac|m4a)(\?.*)?$/i.test(nextTrack.url)) {
        // Direct audio stream URL - pipe through ffmpeg to guarantee 48kHz s16le PCM
        const ffmpeg = spawn(
          ffmpegBin,
          [
            "-reconnect", "1",
            "-reconnect_streamed", "1",
            "-reconnect_delay_max", "5",
            "-analyzeduration", "0",
            "-loglevel", "0",
            "-i", nextTrack.url,
            "-f", "s16le",
            "-ar", "48000",
            "-ac", "2",
            "pipe:1",
          ],
          { stdio: ["ignore", "pipe", "ignore"] }
        );

        queue.streamProcesses = [ffmpeg];

        ffmpeg.on("error", (err) => {
          console.error(`[music:ffmpeg:${guildId}] process spawn error:`, err);
        });

        resource = createAudioResource(ffmpeg.stdout, {
          inputType: StreamType.Raw,
          inlineVolume: true,
        });
      } else {
        // Spawn yt-dlp piped through ffmpeg to s16le 48kHz PCM for zero lag & 100% codec compatibility
        const ytdlp = spawn(
          YTDLP_BIN,
          [
            "-f", "ba/b",
            "--no-playlist",
            "--no-warnings",
            "-q",
            "-o", "-",
            nextTrack.url,
          ],
          { stdio: ["ignore", "pipe", "pipe"] }
        );

        const ffmpeg = spawn(
          ffmpegBin,
          [
            "-analyzeduration", "0",
            "-loglevel", "0",
            "-i", "pipe:0",
            "-f", "s16le",
            "-ar", "48000",
            "-ac", "2",
            "pipe:1",
          ],
          { stdio: ["pipe", "pipe", "ignore"] }
        );

        ytdlp.stdout.pipe(ffmpeg.stdin);
        queue.streamProcesses = [ytdlp, ffmpeg];

        ytdlp.on("error", (err) => {
          console.error(`[music:ytdlp:${guildId}] process error:`, err);
        });

        ffmpeg.on("error", (err) => {
          console.error(`[music:ffmpeg:${guildId}] process error:`, err);
        });

        resource = createAudioResource(ffmpeg.stdout, {
          inputType: StreamType.Raw,
          inlineVolume: true,
        });
      }

      resource.volume?.setVolumeLogarithmic(queue.volume / 100);
      queue.player.play(resource);

      await this.sendControllerMessage(queue);
    } catch (err: any) {
      console.error(`[music:playNext:${guildId}] Stream failed:`, err.message);
      this.killStreamProcesses(queue);
      queue.textChannel
        .send({
          embeds: [
            new EmbedBuilder()
              .setColor(BRAND.colors.warning)
              .setDescription(`⚠️ Could not stream **${nextTrack.title}** (${err.message}). Skipping…`),
          ],
        })
        .catch(() => {});
      this.handleTrackEnd(guildId);
    }
  }

  private handleTrackEnd(guildId: string): void {
    const queue = this.queues.get(guildId);
    if (!queue) return;

    this.killStreamProcesses(queue);

    if (queue.currentTrack) {
      if (queue.loopMode === "track") {
        queue.tracks.unshift(queue.currentTrack);
      } else if (queue.loopMode === "queue") {
        queue.tracks.push(queue.currentTrack);
      }
    }

    this.playNext(guildId);
  }

  public skip(guildId: string): boolean {
    const queue = this.queues.get(guildId);
    if (!queue || !queue.currentTrack) return false;
    this.killStreamProcesses(queue);
    queue.player.stop();
    return true;
  }

  public pause(guildId: string): boolean {
    const queue = this.queues.get(guildId);
    if (!queue || !queue.isPlaying) return false;
    const paused = queue.player.pause();
    if (paused) {
      queue.isPlaying = false;
      queue.pausedAt = Date.now();
    }
    return paused;
  }

  public resume(guildId: string): boolean {
    const queue = this.queues.get(guildId);
    if (!queue || queue.isPlaying) return false;
    const unpaused = queue.player.unpause();
    if (unpaused) {
      queue.isPlaying = true;
      if (queue.pausedAt && queue.playbackStartTime) {
        queue.playbackStartTime += Date.now() - queue.pausedAt;
      }
      queue.pausedAt = undefined;
    }
    return unpaused;
  }

  public stop(guildId: string): boolean {
    const queue = this.queues.get(guildId);
    if (!queue) return false;
    this.killStreamProcesses(queue);
    queue.tracks = [];
    queue.currentTrack = null;
    queue.player.stop();
    this.destroyQueue(guildId);
    return true;
  }

  public setVolume(guildId: string, volume: number): boolean {
    const queue = this.queues.get(guildId);
    if (!queue) return false;
    queue.volume = Math.max(1, Math.min(100, volume));
    const state = queue.player.state;
    if (state.status === AudioPlayerStatus.Playing && (state.resource as any)?.volume) {
      (state.resource as any).volume.setVolumeLogarithmic(queue.volume / 100);
    }
    return true;
  }

  public setLoop(guildId: string, mode: LoopMode): boolean {
    const queue = this.queues.get(guildId);
    if (!queue) return false;
    queue.loopMode = mode;
    return true;
  }

  public shuffle(guildId: string): boolean {
    const queue = this.queues.get(guildId);
    if (!queue || queue.tracks.length <= 1) return false;
    for (let i = queue.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue.tracks[i], queue.tracks[j]] = [queue.tracks[j], queue.tracks[i]];
    }
    return true;
  }

  public clearQueue(guildId: string): boolean {
    const queue = this.queues.get(guildId);
    if (!queue) return false;
    queue.tracks = [];
    return true;
  }

  public destroyQueue(guildId: string): void {
    const queue = this.queues.get(guildId);
    if (!queue) return;
    if (queue.idleTimer) clearTimeout(queue.idleTimer);
    this.killStreamProcesses(queue);
    try {
      queue.player.stop(true);
      const conn = getVoiceConnection(guildId);
      if (conn && conn.state.status !== VoiceConnectionStatus.Destroyed) {
        conn.destroy();
      }
    } catch {}
    this.queues.delete(guildId);
  }

  public buildNowPlayingEmbed(queue: GuildQueue): EmbedBuilder {
    const track = queue.currentTrack;
    if (!track) {
      return new EmbedBuilder()
        .setColor(BRAND.colors.neutral)
        .setDescription("🎵 No song is currently playing.");
    }

    let elapsedSec = 0;
    if (queue.playbackStartTime) {
      elapsedSec = Math.floor(
        ((queue.pausedAt ?? Date.now()) - queue.playbackStartTime) / 1000
      );
    }

    const progressBar = createProgressBar(elapsedSec, track.durationSeconds);
    const loopStatus =
      queue.loopMode === "track"
        ? "🔂 Track"
        : queue.loopMode === "queue"
        ? "🔁 Queue"
        : "Off";

    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.primary)
      .setAuthor({
        name: queue.isPlaying ? "🎵 Now Playing • Vyntric Music" : "⏸️ Paused • Vyntric Music",
      })
      .setTitle(track.title.slice(0, 256))
      .setURL(track.url)
      .setDescription(
        [
          `👤 **Artist / Channel:** ${track.author}`,
          `⏱️ **Progress:** ${progressBar}`,
          "",
          `🔊 **Volume:** \`${queue.volume}%\`  |  🔁 **Loop:** \`${loopStatus}\`  |  📜 **Queue:** \`${queue.tracks.length} track(s)\``,
          `🙋 **Requested by:** <@${track.requesterId}>`,
        ].join("\n")
      )
      .setFooter({ text: "Vyntric Music • Click buttons below for quick control" });

    if (track.thumbnail) {
      embed.setThumbnail(track.thumbnail);
    }

    return embed;
  }

  public buildControllerComponents(queue: GuildQueue): ActionRowBuilder<ButtonBuilder>[] {
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("music:toggle_pause")
        .setLabel(queue.isPlaying ? "Pause" : "Resume")
        .setEmoji(queue.isPlaying ? "⏸️" : "▶️")
        .setStyle(queue.isPlaying ? ButtonStyle.Secondary : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("music:skip")
        .setLabel("Skip")
        .setEmoji("⏭️")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("music:stop")
        .setLabel("Stop")
        .setEmoji("⏹️")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("music:loop")
        .setLabel(`Loop: ${queue.loopMode.toUpperCase()}`)
        .setEmoji("🔁")
        .setStyle(queue.loopMode === "off" ? ButtonStyle.Secondary : ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("music:shuffle")
        .setLabel("Shuffle")
        .setEmoji("🔀")
        .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("music:vol_down")
        .setLabel("-10%")
        .setEmoji("🔉")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("music:vol_up")
        .setLabel("+10%")
        .setEmoji("🔊")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("music:queue")
        .setLabel("Queue")
        .setEmoji("📜")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("music:clear")
        .setLabel("Clear")
        .setEmoji("❌")
        .setStyle(ButtonStyle.Secondary)
    );

    return [row1, row2];
  }

  public async sendControllerMessage(queue: GuildQueue): Promise<void> {
    const embed = this.buildNowPlayingEmbed(queue);
    const components = this.buildControllerComponents(queue);

    try {
      if (queue.controllerMessage) {
        await queue.controllerMessage.edit({
          embeds: [embed],
          components,
        });
      } else {
        const msg = await queue.textChannel.send({
          embeds: [embed],
          components,
        });
        queue.controllerMessage = msg as Message;
      }
    } catch {
      // Channel might not permit editing
    }
  }

  private sendQueueEndedEmbed(queue: GuildQueue) {
    try {
      queue.textChannel
        .send({
          embeds: [
            new EmbedBuilder()
              .setColor(BRAND.colors.rose)
              .setTitle("🏁 Queue Finished")
              .setDescription(
                "All songs have been played! The bot will disconnect in 3 minutes if no new songs are added."
              ),
          ],
        })
        .catch(() => {});
    } catch {}
  }

  public async handleButton(interaction: ButtonInteraction): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) return;

    const queue = this.queues.get(guildId);
    if (!queue) {
      await interaction.reply({
        content: "❌ No active music session in this server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const memberVoice = (interaction.member as any)?.voice?.channelId;
    if (!memberVoice || memberVoice !== queue.voiceChannelId) {
      await interaction.reply({
        content: "❌ You must be in the same voice channel as Vyntric Music to control playback.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const action = interaction.customId.replace("music:", "");

    switch (action) {
      case "toggle_pause": {
        if (queue.isPlaying) {
          this.pause(guildId);
          await interaction.reply({ content: "⏸️ Music paused.", flags: MessageFlags.Ephemeral });
        } else {
          this.resume(guildId);
          await interaction.reply({ content: "▶️ Music resumed.", flags: MessageFlags.Ephemeral });
        }
        await this.sendControllerMessage(queue);
        break;
      }
      case "skip": {
        this.skip(guildId);
        await interaction.reply({ content: "⏭️ Skipped current track.", flags: MessageFlags.Ephemeral });
        break;
      }
      case "stop": {
        this.stop(guildId);
        await interaction.reply({ content: "⏹️ Stopped playback and cleared queue.", flags: MessageFlags.Ephemeral });
        break;
      }
      case "loop": {
        const nextLoop: LoopMode =
          queue.loopMode === "off" ? "track" : queue.loopMode === "track" ? "queue" : "off";
        this.setLoop(guildId, nextLoop);
        await interaction.reply({ content: `🔁 Loop mode set to **${nextLoop.toUpperCase()}**.`, flags: MessageFlags.Ephemeral });
        await this.sendControllerMessage(queue);
        break;
      }
      case "shuffle": {
        const ok = this.shuffle(guildId);
        await interaction.reply({
          content: ok ? "🔀 Queue shuffled!" : "⚠️ Not enough songs in queue to shuffle.",
          flags: MessageFlags.Ephemeral,
        });
        break;
      }
      case "vol_down": {
        const newVol = Math.max(10, queue.volume - 10);
        this.setVolume(guildId, newVol);
        await interaction.reply({ content: `🔉 Volume lowered to **${newVol}%**.`, flags: MessageFlags.Ephemeral });
        await this.sendControllerMessage(queue);
        break;
      }
      case "vol_up": {
        const newVol = Math.min(100, queue.volume + 10);
        this.setVolume(guildId, newVol);
        await interaction.reply({ content: `🔊 Volume raised to **${newVol}%**.`, flags: MessageFlags.Ephemeral });
        await this.sendControllerMessage(queue);
        break;
      }
      case "queue": {
        if (queue.tracks.length === 0) {
          await interaction.reply({
            content: `📜 **Queue is empty!** Currently playing: **${queue.currentTrack?.title || "None"}**`,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          const trackList = queue.tracks
            .slice(0, 10)
            .map((t, i) => `**${i + 1}.** [${t.title}](${t.url}) (\`${t.durationFormatted}\`)`)
            .join("\n");
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(BRAND.colors.primary)
                .setTitle(`📜 Vyntric Queue (${queue.tracks.length} tracks)`)
                .setDescription(
                  `**Now Playing:** [${queue.currentTrack?.title}](${queue.currentTrack?.url})\n\n**Next Up:**\n${trackList}`
                ),
            ],
            flags: MessageFlags.Ephemeral,
          });
        }
        break;
      }
      case "clear": {
        this.clearQueue(guildId);
        await interaction.reply({ content: "🗑️ Cleared upcoming queue.", flags: MessageFlags.Ephemeral });
        await this.sendControllerMessage(queue);
        break;
      }
      default: {
        await interaction.reply({ content: "Unknown action.", flags: MessageFlags.Ephemeral });
      }
    }
  }
}

export const musicManager = MusicManager.getInstance();
