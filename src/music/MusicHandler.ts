import { Player, Track, LoadType, Node } from "shoukaku";
import { GuildMember, TextBasedChannel } from "discord.js";
import { VyntricClient } from "../structures/VyntricClient";

export interface GuildCurrentTrack {
  track: Track;
  requestedBy?: string;
  startedAt: number;
}

export interface PlayResult {
  success: boolean;
  message: string;
  isPlaylist?: boolean;
  playlistName?: string;
  tracksAdded?: number;
  firstTrack?: Track;
}

function normalizeQuery(input: string): string {
  const trimmed = input.trim();

  // YouTube Shorts: https://www.youtube.com/shorts/<id> -> https://www.youtube.com/watch?v=<id>
  const shortsMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/i
  );
  if (shortsMatch) {
    return `https://www.youtube.com/watch?v=${shortsMatch[1]}`;
  }

  return trimmed;
}

export class MusicHandler {
  private client: VyntricClient;
  public queue: Map<string, Track[]> = new Map();
  public players: Map<string, Player> = new Map();
  public currentTracks: Map<string, GuildCurrentTrack> = new Map();
  public loopModes: Map<string, "off" | "track" | "queue"> = new Map();
  public autoplay: Map<string, boolean> = new Map();

  constructor(client: VyntricClient) {
    this.client = client;
  }

  private async resolveTrackOrPlaylist(node: Node, query: string): Promise<any> {
    const normalized = normalizeQuery(query);
    const isUrl = /^https?:\/\//i.test(normalized);

    if (isUrl) {
      // 1. Apple Music detection & slug search fallback
      if (/music\.apple\.com/i.test(normalized)) {
        try {
          const direct = await node.rest.resolve(normalized);
          if (
            direct &&
            (direct.loadType === LoadType.TRACK || direct.loadType === LoadType.PLAYLIST)
          ) {
            return direct;
          }
        } catch {}

        try {
          const urlObj = new URL(normalized);
          const parts = urlObj.pathname.split("/").filter(Boolean);
          const slug = parts[2] || parts[parts.length - 1] || "";
          const cleanSlug = decodeURIComponent(slug).replace(/[-_]/g, " ").trim();
          if (cleanSlug) {
            const fallback = await node.rest.resolve(`ytsearch:${cleanSlug}`);
            if (
              fallback &&
              (fallback.loadType === LoadType.SEARCH || fallback.loadType === LoadType.TRACK)
            ) {
              return fallback;
            }
          }
        } catch {}
      }

      // 2. Direct URL resolve (YouTube, Spotify playlists, albums, SoundCloud, streams)
      try {
        const direct = await node.rest.resolve(normalized);
        if (direct && direct.loadType !== LoadType.EMPTY && direct.loadType !== LoadType.ERROR) {
          return direct;
        }

        // Clean YouTube watch URL if it had mix playlist param (&list=RD...)
        if (
          /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]+)/i.test(normalized) &&
          normalized.includes("&list=")
        ) {
          const vMatch = normalized.match(/v=([a-zA-Z0-9_-]+)/i);
          if (vMatch) {
            const cleanRes = await node.rest.resolve(`https://www.youtube.com/watch?v=${vMatch[1]}`);
            if (
              cleanRes &&
              cleanRes.loadType !== LoadType.EMPTY &&
              cleanRes.loadType !== LoadType.ERROR
            ) {
              return cleanRes;
            }
          }
        }

        return direct;
      } catch (err: any) {
        console.warn(`[MusicHandler:resolve] error resolving URL ${normalized}:`, err?.message || err);
      }
    }

    // 3. Search query: Try ytsearch -> scsearch -> spsearch
    const searchEngines = ["ytsearch:", "scsearch:", "spsearch:"];
    for (const prefix of searchEngines) {
      try {
        const res = await node.rest.resolve(`${prefix}${normalized}`);
        if (
          res &&
          res.loadType === LoadType.SEARCH &&
          Array.isArray(res.data) &&
          res.data.length > 0
        ) {
          return res;
        }
      } catch {}
    }

    return null;
  }

  public async play(
    member: GuildMember,
    query: string,
    textChannel?: TextBasedChannel
  ): Promise<PlayResult> {
    if (!member.voice?.channelId) {
      return { success: false, message: "❌ You must be in a voice channel!" };
    }

    if (!this.client.shoukaku) {
      return { success: false, message: "❌ Lavalink audio system is not initialized." };
    }

    const node = this.client.shoukaku.options.nodeResolver(this.client.shoukaku.nodes);
    if (!node) {
      return {
        success: false,
        message: "❌ No Lavalink node available. Please check server connection.",
      };
    }

    let result: any = null;
    try {
      result = await this.resolveTrackOrPlaylist(node, query);
    } catch (err: any) {
      console.error("[MusicHandler:resolve] Error resolving track:", err?.message || err);
      return {
        success: false,
        message: `❌ Failed to resolve track: ${err?.message || "Unknown error"}`,
      };
    }

    if (!result || result.loadType === LoadType.EMPTY) {
      return { success: false, message: "❌ No results found." };
    }

    if (result.loadType === LoadType.ERROR) {
      const errorMsg = (result.data as any)?.message || "Track loading failed.";
      return { success: false, message: `❌ Lavalink error: ${errorMsg}` };
    }

    let tracksToAdd: Track[] = [];
    let isPlaylist = false;
    let playlistName = "";

    if (result.loadType === LoadType.PLAYLIST) {
      isPlaylist = true;
      playlistName = (result.data as any)?.info?.name || "Playlist";
      tracksToAdd = (result.data as any)?.tracks || [];
    } else if (result.loadType === LoadType.TRACK) {
      tracksToAdd = [result.data as Track];
    } else if (result.loadType === LoadType.SEARCH) {
      const searchResults = result.data as Track[];
      if (searchResults && searchResults.length > 0) {
        tracksToAdd = [searchResults[0]];
      }
    }

    if (tracksToAdd.length === 0 || !tracksToAdd[0]) {
      return { success: false, message: "❌ No playable tracks found." };
    }

    let player = this.players.get(member.guild.id);

    if (!player) {
      try {
        player = await this.client.shoukaku.joinVoiceChannel({
          guildId: member.guild.id,
          channelId: member.voice.channelId,
          shardId: member.guild.shardId,
          deaf: true,
        });

        this.players.set(member.guild.id, player);

        player.on("end", () => {
          this.handleTrackEnd(member.guild.id);
        });

        player.on("closed", () => {
          this.players.delete(member.guild.id);
          this.queue.delete(member.guild.id);
          this.currentTracks.delete(member.guild.id);
        });

        player.on("exception", (error) => {
          console.error(`[MusicHandler:player:${member.guild.id}] Exception:`, error);
          this.playNext(member.guild.id);
        });
      } catch (error: any) {
        console.error("[MusicHandler:joinVoiceChannel]", error);
        return { success: false, message: "❌ Failed to join voice channel." };
      }
    }

    if (!player) {
      return { success: false, message: "❌ Failed to initialize player." };
    }

    const guildQueue = this.queue.get(member.guild.id) || [];
    guildQueue.push(...tracksToAdd);
    this.queue.set(member.guild.id, guildQueue);

    const firstTrack = tracksToAdd[0];
    const firstTitle = firstTrack.info?.title || "Unknown Title";

    if (!player.track) {
      await this.playNext(member.guild.id, member.user.tag);
      const msg = isPlaylist
        ? `🎶 Playing **${firstTitle}** and queued **${tracksToAdd.length - 1}** more track(s) from playlist **${playlistName}**`
        : `🎶 Playing **${firstTitle}**`;

      return {
        success: true,
        message: msg,
        isPlaylist,
        playlistName,
        tracksAdded: tracksToAdd.length,
        firstTrack,
      };
    } else {
      const msg = isPlaylist
        ? `📜 Added **${tracksToAdd.length}** track(s) from playlist **${playlistName}** to queue`
        : `📜 Added to queue: **${firstTitle}**`;

      return {
        success: true,
        message: msg,
        isPlaylist,
        playlistName,
        tracksAdded: tracksToAdd.length,
        firstTrack,
      };
    }
  }

  public async playNext(guildId: string, requestedBy?: string): Promise<void> {
    const player = this.players.get(guildId);
    const queue = this.queue.get(guildId);

    if (!player) return;

    if (!queue || queue.length === 0) {
      this.currentTracks.delete(guildId);
      return;
    }

    const track = queue.shift();
    if (track) {
      this.currentTracks.set(guildId, {
        track,
        requestedBy: requestedBy || this.currentTracks.get(guildId)?.requestedBy,
        startedAt: Date.now(),
      });
      await player.playTrack({ track: { encoded: track.encoded } });
    }
  }

  private async handleTrackEnd(guildId: string): Promise<void> {
    const loopMode = this.loopModes.get(guildId) || "off";
    const current = this.currentTracks.get(guildId);

    if (current && loopMode === "track") {
      const queue = this.queue.get(guildId) || [];
      queue.unshift(current.track);
      this.queue.set(guildId, queue);
      await this.playNext(guildId, current.requestedBy);
      return;
    } else if (current && loopMode === "queue") {
      const queue = this.queue.get(guildId) || [];
      queue.push(current.track);
      this.queue.set(guildId, queue);
      await this.playNext(guildId, current.requestedBy);
      return;
    }

    const queue = this.queue.get(guildId) || [];
    if (queue.length > 0) {
      await this.playNext(guildId, current?.requestedBy);
      return;
    }

    // Queue is empty, check autoplay
    if (this.isAutoplay(guildId) && current) {
      try {
        const node = this.client.shoukaku.options.nodeResolver(this.client.shoukaku.nodes);
        if (node) {
          const query = `ytsearch:${current.track.info.author || ""} ${current.track.info.title || ""}`.trim();
          const result = await node.rest.resolve(query);
          if (
            result &&
            result.loadType === LoadType.SEARCH &&
            Array.isArray(result.data) &&
            result.data.length > 1
          ) {
            const nextTrack =
              result.data.find(
                (t: Track) => t.info.identifier !== current.track.info.identifier
              ) || result.data[1];

            if (nextTrack) {
              queue.push(nextTrack);
              this.queue.set(guildId, queue);
              await this.playNext(guildId, "Autoplay");
              return;
            }
          }
        }
      } catch (err) {
        console.warn(`[MusicHandler:autoplay:${guildId}] error:`, err);
      }
    }

    this.currentTracks.delete(guildId);
  }

  public async stop(guildId: string): Promise<boolean> {
    const player = this.players.get(guildId);
    if (player) {
      await player.stopTrack();
      this.queue.set(guildId, []);
      this.currentTracks.delete(guildId);
      this.client.shoukaku.leaveVoiceChannel(guildId);
      this.players.delete(guildId);
      return true;
    }
    return false;
  }

  public async skip(guildId: string): Promise<boolean> {
    const player = this.players.get(guildId);
    if (player) {
      await player.stopTrack();
      return true;
    }
    return false;
  }

  public async pause(guildId: string): Promise<boolean> {
    const player = this.players.get(guildId);
    if (player) {
      await player.setPaused(true);
      return true;
    }
    return false;
  }

  public async resume(guildId: string): Promise<boolean> {
    const player = this.players.get(guildId);
    if (player) {
      await player.setPaused(false);
      return true;
    }
    return false;
  }

  public async setVolume(guildId: string, volume: number): Promise<boolean> {
    const player = this.players.get(guildId);
    if (player) {
      const clamped = Math.max(10, Math.min(volume, 200));
      await player.setGlobalVolume(clamped);
      return true;
    }
    return false;
  }

  public shuffle(guildId: string): boolean {
    const queue = this.queue.get(guildId);
    if (queue && queue.length > 1) {
      for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
      }
      return true;
    }
    return false;
  }

  public setLoop(guildId: string, mode: "off" | "track" | "queue"): "off" | "track" | "queue" {
    this.loopModes.set(guildId, mode);
    return mode;
  }

  public getLoop(guildId: string): "off" | "track" | "queue" {
    return this.loopModes.get(guildId) || "off";
  }

  public setAutoplay(guildId: string, enabled: boolean): boolean {
    this.autoplay.set(guildId, enabled);
    return enabled;
  }

  public isAutoplay(guildId: string): boolean {
    return this.autoplay.get(guildId) ?? false;
  }

  public getNowPlaying(guildId: string): GuildCurrentTrack | null {
    return this.currentTracks.get(guildId) || null;
  }
}
