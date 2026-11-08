import { ChildProcess } from "child_process";
import {
  AudioPlayer,
  VoiceConnection,
} from "@discordjs/voice";
import { Message, TextBasedChannel } from "discord.js";

export type LoopMode = "off" | "track" | "queue";

export interface Track {
  id: string;
  title: string;
  url: string;
  durationSeconds: number;
  durationFormatted: string;
  thumbnail: string;
  author: string;
  requesterId: string;
  requesterTag: string;
  platform: "soundcloud" | "youtube" | "spotify" | "url";
}

export interface GuildQueue {
  guildId: string;
  voiceChannelId: string;
  textChannel: any;
  connection: VoiceConnection;
  player: AudioPlayer;
  tracks: Track[];
  currentTrack: Track | null;
  volume: number; // 1-100
  loopMode: LoopMode;
  controllerMessage?: Message;
  isPlaying: boolean;
  idleTimer?: NodeJS.Timeout;
  playbackStartTime?: number;
  pausedAt?: number;
  streamProcess?: ChildProcess;
  streamProcesses?: ChildProcess[];
}
