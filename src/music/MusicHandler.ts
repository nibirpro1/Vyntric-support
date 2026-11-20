import { Player, Track, LoadType } from "shoukaku";
import { GuildMember, TextBasedChannel } from "discord.js";
import { VyntricClient } from "../structures/VyntricClient";

export interface GuildCurrentTrack {
  track: Track;
  requestedBy?: string;
  startedAt: number;
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

  public async play(
    member: GuildMember,
    query: string,
    textChannel?: TextBasedChannel
  ): Promise<string> {
    if (!member.voice?.channelId) {
      return "❌ You must be in a voice channel!";
    }

    if (!this.client.shoukaku) {
      return "❌ Lavalink audio system is not initialized.";
    }

    const node = this.client.shoukaku.options.nodeResolver(this.client.shoukaku.nodes);
    if (!node) {
      return "❌ No Lavalink node available. Please check server connection.";
    }

    const trimmed = query.trim();
    const identifier = /^https?:\/\//i.test(trimmed) ? trimmed : `ytsearch:${trimmed}`;

    let result;
    try {
      result = await node.rest.resolve(identifier);
    } catch (err: any) {
      console.error("[MusicHandler:resolve] Error resolving track:", err?.message || err);
      return `❌ Failed to resolve track: ${err?.message || "Unknown error"}`;
    }

    if (!result || result.loadType === LoadType.EMPTY) {
      return "❌ No results found.";
    }

    if (result.loadType === LoadType.ERROR) {
      const errorMsg = (result.data as any)?.message || "Track loading failed.";
      return `❌ Lavalink error: ${errorMsg}`;
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
      return "❌ No playable tracks found.";
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
        return "❌ Failed to join voice channel.";
      }
    }

    if (!player) {
      return "❌ Failed to initialize player.";
    }

    const guildQueue = this.queue.get(member.guild.id) || [];
    guildQueue.push(...tracksToAdd);
    this.queue.set(member.guild.id, guildQueue);

    const firstTrack = tracksToAdd[0];
    const firstTitle = firstTrack.info?.title || "Unknown Title";

    if (!player.track) {
      await this.playNext(member.guild.id, member.user.tag);
      return isPlaylist
        ? `🎶 Playing **${firstTitle}** and queued **${tracksToAdd.length - 1}** more track(s) from playlist **${playlistName}**`
        : `🎶 Playing **${firstTitle}**`;
    } else {
      return isPlaylist
        ? `📜 Added **${tracksToAdd.length}** track(s) from playlist **${playlistName}** to queue`
        : `📜 Added to queue: **${firstTitle}**`;
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
