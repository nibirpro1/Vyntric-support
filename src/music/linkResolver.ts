import { execFile } from "child_process";
import fs from "fs";
import path from "path";
const ytSearch = require("yt-search");
import { Track } from "./types";

function getYtDlpPath(): string {
  const binaryName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
  const localBin = path.resolve(process.cwd(), "bin", binaryName);
  if (fs.existsSync(localBin)) {
    try {
      if (process.platform !== "win32") {
        fs.chmodSync(localBin, 0o755);
      }
    } catch {}
    return localBin;
  }
  if (fs.existsSync("/usr/local/bin/yt-dlp")) {
    return "/usr/local/bin/yt-dlp";
  }
  if (fs.existsSync("/usr/bin/yt-dlp")) {
    return "/usr/bin/yt-dlp";
  }
  return "yt-dlp";
}

const YTDLP_BIN = getYtDlpPath();

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

export function isDirectMediaUrl(url: string): boolean {
  return /^https?:\/\/.*\.(mp3|wav|ogg|aac|m4a|flac|opus|webm|mp4|m3u8|pls|m3u)(\?.*)?$/i.test(url.trim());
}

export async function resolveRedirect(url: string): Promise<string> {
  if (
    /spotify\.link|on\.soundcloud\.com|deezer\.page\.link|tinyurl\.com|bit\.ly|t\.co|vm\.tiktok\.com/i.test(
      url
    )
  ) {
    try {
      const res = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
      });
      if (res.url && res.url !== url) {
        return res.url;
      }
    } catch {
      try {
        const res = await fetch(url, {
          method: "GET",
          redirect: "follow",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          },
        });
        if (res.url && res.url !== url) {
          return res.url;
        }
      } catch {}
    }
  }
  return url;
}

export async function searchYouTubeTrack(query: string): Promise<{
  url: string;
  title: string;
  duration: number;
  thumbnail: string;
  author: string;
  id: string;
} | null> {
  const clean = query.trim();
  if (!clean) return null;

  try {
    const res = await ytSearch(clean);
    if (res && res.videos && res.videos.length > 0) {
      const v = res.videos[0];
      return {
        id: `yt_${v.videoId}`,
        url: v.url || `https://www.youtube.com/watch?v=${v.videoId}`,
        title: v.title,
        duration: v.duration?.seconds || 0,
        thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
        author: v.author?.name || "YouTube Creator",
      };
    }
  } catch (err: any) {
    console.warn(`[linkResolver:ytSearch] query "${clean}" error:`, err?.message || err);
  }

  // Fallback to yt-dlp search
  return new Promise((resolve) => {
    execFile(
      YTDLP_BIN,
      [
        "--dump-json",
        "--no-playlist",
        "--no-warnings",
        "--extractor-args",
        "youtube:player_client=android,web,tv",
        "-q",
        `ytsearch1:${clean}`,
      ],
      { timeout: 15_000, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout) => {
        if (err || !stdout) return resolve(null);
        try {
          const lines = stdout.trim().split("\n").filter(Boolean);
          if (lines.length === 0) return resolve(null);
          const meta = JSON.parse(lines[0]);
          const id = meta.id || `yt_${Date.now()}`;
          resolve({
            id: `yt_${id}`,
            url: meta.webpage_url || `https://www.youtube.com/watch?v=${id}`,
            title: meta.title || clean,
            duration: Math.round(meta.duration || 0),
            thumbnail: meta.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            author: meta.uploader || meta.channel || "YouTube Creator",
          });
        } catch {
          resolve(null);
        }
      }
    );
  });
}

// 1. Spotify Resolver (Tracks, Albums, Playlists)
export async function resolveSpotify(
  url: string,
  requesterId: string,
  requesterTag: string
): Promise<Track[]> {
  const match = url.match(
    /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(track|album|playlist)\/([a-zA-Z0-9]+)/i
  );
  if (!match) return [];
  const kind = match[1].toLowerCase();
  const id = match[2];

  try {
    const embedUrl = `https://open.spotify.com/embed/${kind}/${id}`;
    const res = await fetch(embedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      // Fallback to oembed for single track
      return resolveSpotifyOembed(url, requesterId, requesterTag);
    }

    const html = await res.text();
    const nextDataMatch = html.match(/<script id=\"__NEXT_DATA__\"[^>]*>([^<]+)<\/script>/);
    if (!nextDataMatch) {
      return resolveSpotifyOembed(url, requesterId, requesterTag);
    }

    const json = JSON.parse(nextDataMatch[1]);
    const entity = json.props?.pageProps?.state?.data?.entity;
    if (!entity) {
      return resolveSpotifyOembed(url, requesterId, requesterTag);
    }

    if (kind === "track") {
      const title = entity.name || "Unknown Track";
      const artist =
        entity.artists && entity.artists.length > 0
          ? entity.artists.map((a: any) => a.name).join(", ")
          : "Unknown Artist";
      const durSec = Math.round((entity.duration || 0) / 1000);
      const thumbnail =
        entity.visualIdentity?.image?.[0]?.url ||
        "https://cdn.discordapp.com/embed/avatars/0.png";

      const ytMatch = await searchYouTubeTrack(`${artist} - ${title}`);
      return [
        {
          id: ytMatch ? ytMatch.id : `sp_${id}`,
          title,
          url: ytMatch ? ytMatch.url : `ytsearch:${artist} - ${title}`,
          durationSeconds: durSec || ytMatch?.duration || 0,
          durationFormatted:
            durSec > 0
              ? formatSeconds(durSec)
              : ytMatch?.duration
              ? formatSeconds(ytMatch.duration)
              : "Unknown",
          thumbnail: thumbnail || ytMatch?.thumbnail || "",
          author: artist,
          requesterId,
          requesterTag,
          platform: "spotify",
          originalUrl: url,
        },
      ];
    } else {
      // Album or Playlist
      const collectionTitle = entity.title || entity.name || "Spotify Collection";
      const trackList: any[] = entity.trackList || [];
      const tracks: Track[] = [];

      for (let i = 0; i < Math.min(trackList.length, 50); i++) {
        const item = trackList[i];
        const title = item.title || `Track ${i + 1}`;
        const artist =
          item.subtitle ||
          (entity.artists && entity.artists.length > 0
            ? entity.artists[0]?.name
            : "Spotify Artist");
        const durSec = Math.round((item.duration || 0) / 1000);
        const thumbnail =
          entity.visualIdentity?.image?.[0]?.url ||
          "https://cdn.discordapp.com/embed/avatars/0.png";

        // For the first track, resolve immediately so playback starts instantly
        if (i === 0) {
          const ytMatch = await searchYouTubeTrack(`${artist} - ${title}`);
          tracks.push({
            id: ytMatch ? ytMatch.id : `sp_${id}_0`,
            title,
            url: ytMatch ? ytMatch.url : `ytsearch:${artist} - ${title}`,
            durationSeconds: durSec || ytMatch?.duration || 0,
            durationFormatted:
              durSec > 0
                ? formatSeconds(durSec)
                : ytMatch?.duration
                ? formatSeconds(ytMatch.duration)
                : "Unknown",
            thumbnail: thumbnail || ytMatch?.thumbnail || "",
            author: artist,
            requesterId,
            requesterTag,
            platform: "spotify",
            originalUrl: url,
          });
        } else {
          // Defer subsequent tracks with ytsearch: query string for instant queuing
          tracks.push({
            id: `sp_${id}_${i}`,
            title,
            url: `ytsearch:${artist} - ${title}`,
            durationSeconds: durSec,
            durationFormatted: durSec > 0 ? formatSeconds(durSec) : "Queued",
            thumbnail,
            author: artist,
            requesterId,
            requesterTag,
            platform: "spotify",
            originalUrl: url,
          });
        }
      }

      return tracks;
    }
  } catch (err: any) {
    console.warn("[linkResolver:resolveSpotify] error:", err?.message || err);
    return resolveSpotifyOembed(url, requesterId, requesterTag);
  }
}

async function resolveSpotifyOembed(
  url: string,
  requesterId: string,
  requesterTag: string
): Promise<Track[]> {
  try {
    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
    const res = await fetch(oembedUrl);
    if (!res.ok) return [];
    const data: any = await res.json();
    const title = data.title || "Spotify Track";
    const thumbnail = data.thumbnail_url || "";
    const ytMatch = await searchYouTubeTrack(title);
    return [
      {
        id: ytMatch ? ytMatch.id : `sp_${Date.now()}`,
        title,
        url: ytMatch ? ytMatch.url : `ytsearch:${title}`,
        durationSeconds: ytMatch?.duration || 0,
        durationFormatted: ytMatch?.duration ? formatSeconds(ytMatch.duration) : "Unknown",
        thumbnail: thumbnail || ytMatch?.thumbnail || "",
        author: "Spotify Artist",
        requesterId,
        requesterTag,
        platform: "spotify",
        originalUrl: url,
      },
    ];
  } catch {
    return [];
  }
}

// 2. Apple Music Resolver (Songs, Albums, Playlists)
export async function resolveAppleMusic(
  url: string,
  requesterId: string,
  requesterTag: string
): Promise<Track[]> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) return [];
    const html = await res.text();

    // Check for Schema JSON
    const schemaMatch = html.match(/<script\s+id=[\"']?schema:[^>]*>([\s\S]*?)<\/script>/i);
    if (schemaMatch) {
      try {
        const schema = JSON.parse(schemaMatch[1]);
        const schemaType = schema["@type"];
        const primaryArtist =
          schema.byArtist?.[0]?.name ||
          schema.byArtist?.name ||
          "Apple Music Artist";
        const albumThumb = schema.image || "";

        // Check if this is a single song link inside an album, e.g. ?i=1499378607
        const songIdMatch = url.match(/[?&]i=(\d+)/);
        if (songIdMatch && schema.tracks && schema.tracks.length > 0) {
          const targetSong = schema.tracks.find((t: any) =>
            t.url?.includes(songIdMatch[1])
          );
          if (targetSong) {
            const title = targetSong.name;
            const ytMatch = await searchYouTubeTrack(`${primaryArtist} - ${title}`);
            return [
              {
                id: ytMatch ? ytMatch.id : `am_${songIdMatch[1]}`,
                title,
                url: ytMatch ? ytMatch.url : `ytsearch:${primaryArtist} - ${title}`,
                durationSeconds: ytMatch?.duration || 0,
                durationFormatted: ytMatch?.duration ? formatSeconds(ytMatch.duration) : "Unknown",
                thumbnail:
                  targetSong.audio?.thumbnailUrl || albumThumb || ytMatch?.thumbnail || "",
                author: primaryArtist,
                requesterId,
                requesterTag,
                platform: "apple",
                originalUrl: url,
              },
            ];
          }
        }

        // If it has multiple tracks (Album / Playlist)
        if (schema.tracks && schema.tracks.length > 0) {
          const tracks: Track[] = [];
          for (let i = 0; i < Math.min(schema.tracks.length, 50); i++) {
            const item = schema.tracks[i];
            const title = item.name || `Track ${i + 1}`;
            const artist = primaryArtist;
            const thumb = item.audio?.thumbnailUrl || albumThumb;

            if (i === 0) {
              const ytMatch = await searchYouTubeTrack(`${artist} - ${title}`);
              tracks.push({
                id: ytMatch ? ytMatch.id : `am_${i}`,
                title,
                url: ytMatch ? ytMatch.url : `ytsearch:${artist} - ${title}`,
                durationSeconds: ytMatch?.duration || 0,
                durationFormatted: ytMatch?.duration
                  ? formatSeconds(ytMatch.duration)
                  : "Unknown",
                thumbnail: thumb || ytMatch?.thumbnail || "",
                author: artist,
                requesterId,
                requesterTag,
                platform: "apple",
                originalUrl: url,
              });
            } else {
              tracks.push({
                id: `am_${i}`,
                title,
                url: `ytsearch:${artist} - ${title}`,
                durationSeconds: 0,
                durationFormatted: "Queued",
                thumbnail: thumb,
                author: artist,
                requesterId,
                requesterTag,
                platform: "apple",
                originalUrl: url,
              });
            }
          }
          return tracks;
        }
      } catch {}
    }

    // Fallback: og meta tags
    let ogTitle = html.match(/<meta property=\"og:title\" content=\"([^\"]+)\"/i)?.[1] || "";
    let ogImage = html.match(/<meta property=\"og:image\" content=\"([^\"]+)\"/i)?.[1] || "";
    ogTitle = ogTitle
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .trim();

    if (ogTitle) {
      const songMatch = ogTitle.match(/^(.*?)\s+by\s+(.*?)\s+on Apple\s*Music/i);
      let title = ogTitle;
      let artist = "Apple Music Artist";
      if (songMatch) {
        title = songMatch[1].trim();
        artist = songMatch[2].trim();
      }

      const ytMatch = await searchYouTubeTrack(`${artist} - ${title}`);
      return [
        {
          id: ytMatch ? ytMatch.id : `am_${Date.now()}`,
          title,
          url: ytMatch ? ytMatch.url : `ytsearch:${artist} - ${title}`,
          durationSeconds: ytMatch?.duration || 0,
          durationFormatted: ytMatch?.duration ? formatSeconds(ytMatch.duration) : "Unknown",
          thumbnail: ogImage || ytMatch?.thumbnail || "",
          author: artist,
          requesterId,
          requesterTag,
          platform: "apple",
          originalUrl: url,
        },
      ];
    }
  } catch (err: any) {
    console.warn("[linkResolver:resolveAppleMusic] error:", err?.message || err);
  }
  return [];
}

// 3. SoundCloud Resolver
export async function resolveSoundCloud(
  url: string,
  requesterId: string,
  requesterTag: string
): Promise<Track[]> {
  try {
    // 1. Check if yt-dlp can get metadata directly without restriction
    const meta = await new Promise<any>((resolve) => {
      execFile(
        YTDLP_BIN,
        ["--dump-json", "--no-playlist", "--no-warnings", "-q", url],
        { timeout: 12_000, maxBuffer: 10 * 1024 * 1024 },
        (err, stdout) => {
          if (err || !stdout) return resolve(null);
          try {
            resolve(JSON.parse(stdout));
          } catch {
            resolve(null);
          }
        }
      );
    });

    if (meta && meta.title) {
      const durSec = Math.round(meta.duration || 0);
      return [
        {
          id: `sc_${meta.id || Date.now()}`,
          title: meta.title,
          url: meta.webpage_url || url,
          durationSeconds: durSec,
          durationFormatted: durSec > 0 ? formatSeconds(durSec) : "Live Stream",
          thumbnail: meta.thumbnail || "",
          author: meta.uploader || meta.channel || "SoundCloud Artist",
          requesterId,
          requesterTag,
          platform: "soundcloud",
          originalUrl: url,
        },
      ];
    }

    // 2. Fallback: SoundCloud oEmbed (handles geo-restrictions & DRM by mapping to YouTube)
    const oembedUrl = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`;
    const res = await fetch(oembedUrl);
    if (res.ok) {
      const data: any = await res.json();
      let rawTitle = data.title || "SoundCloud Track";
      const author = data.author_name || "SoundCloud Artist";
      const thumb = data.thumbnail_url || "";
      const cleanTitle = rawTitle.replace(new RegExp(`\\s+by\\s+${author}$`, "i"), "").trim();

      const ytMatch = await searchYouTubeTrack(`${cleanTitle} ${author}`);
      return [
        {
          id: ytMatch ? ytMatch.id : `sc_${Date.now()}`,
          title: cleanTitle,
          url: ytMatch ? ytMatch.url : `ytsearch:${cleanTitle} ${author}`,
          durationSeconds: ytMatch?.duration || 0,
          durationFormatted: ytMatch?.duration ? formatSeconds(ytMatch.duration) : "Unknown",
          thumbnail: thumb || ytMatch?.thumbnail || "",
          author,
          requesterId,
          requesterTag,
          platform: "soundcloud",
          originalUrl: url,
        },
      ];
    }
  } catch (err: any) {
    console.warn("[linkResolver:resolveSoundCloud] error:", err?.message || err);
  }
  return [];
}

// 4. Deezer Resolver
export async function resolveDeezer(
  url: string,
  requesterId: string,
  requesterTag: string
): Promise<Track[]> {
  try {
    const oembedUrl = `https://api.deezer.com/oembed?url=${encodeURIComponent(url)}`;
    const res = await fetch(oembedUrl);
    if (res.ok) {
      const data: any = await res.json();
      const title = data.title || "Deezer Track";
      const artist = data.author_name || "Deezer Artist";
      const thumb = data.thumbnail_url || "";
      const ytMatch = await searchYouTubeTrack(`${artist} - ${title}`);
      return [
        {
          id: ytMatch ? ytMatch.id : `dz_${data.id || Date.now()}`,
          title,
          url: ytMatch ? ytMatch.url : `ytsearch:${artist} - ${title}`,
          durationSeconds: ytMatch?.duration || 0,
          durationFormatted: ytMatch?.duration ? formatSeconds(ytMatch.duration) : "Unknown",
          thumbnail: thumb || ytMatch?.thumbnail || "",
          author: artist,
          requesterId,
          requesterTag,
          platform: "deezer",
          originalUrl: url,
        },
      ];
    }
  } catch (err: any) {
    console.warn("[linkResolver:resolveDeezer] error:", err?.message || err);
  }
  return [];
}

// 5. Generic Web / Video / Media Resolver (Bandcamp, Vimeo, Twitch, TikTok, etc.)
export async function resolveGenericMediaUrl(
  url: string,
  requesterId: string,
  requesterTag: string
): Promise<Track[]> {
  // 1. Try yt-dlp metadata
  const meta = await new Promise<any>((resolve) => {
    execFile(
      YTDLP_BIN,
      ["--dump-json", "--no-playlist", "--no-warnings", "-q", url],
      { timeout: 15_000, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout) => {
        if (err || !stdout) return resolve(null);
        try {
          resolve(JSON.parse(stdout));
        } catch {
          resolve(null);
        }
      }
    );
  });

  if (meta && meta.title) {
    const durSec = Math.round(meta.duration || 0);
    return [
      {
        id: `web_${Date.now()}`,
        title: meta.title,
        url: meta.webpage_url || url,
        durationSeconds: durSec,
        durationFormatted: durSec > 0 ? formatSeconds(durSec) : "Live Stream",
        thumbnail: meta.thumbnail || "https://cdn.discordapp.com/embed/avatars/0.png",
        author: meta.uploader || meta.channel || "Web Artist",
        requesterId,
        requesterTag,
        platform: "url",
        originalUrl: url,
      },
    ];
  }

  // 2. Fallback: OpenGraph scraping from any web URL
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
    });
    if (res.ok) {
      const html = await res.text();
      let title =
        html.match(/<meta property=\"og:title\" content=\"([^\"]+)\"/i)?.[1] ||
        html.match(/<title>([^<]+)<\/title>/i)?.[1] ||
        "";
      title = title.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
      let thumb =
        html.match(/<meta property=\"og:image\" content=\"([^\"]+)\"/i)?.[1] ||
        "https://cdn.discordapp.com/embed/avatars/0.png";

      if (title) {
        const ytMatch = await searchYouTubeTrack(title);
        return [
          {
            id: ytMatch ? ytMatch.id : `web_${Date.now()}`,
            title,
            url: ytMatch ? ytMatch.url : `ytsearch:${title}`,
            durationSeconds: ytMatch?.duration || 0,
            durationFormatted: ytMatch?.duration ? formatSeconds(ytMatch.duration) : "Live Stream",
            thumbnail: thumb || ytMatch?.thumbnail || "",
            author: "Web Stream",
            requesterId,
            requesterTag,
            platform: "url",
            originalUrl: url,
          },
        ];
      }
    }
  } catch {}

  return [];
}
