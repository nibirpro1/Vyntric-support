import { musicManager, getYtdlClient } from "../music/MusicManager";

async function testMusic() {
  console.log("=== Testing Music Pipeline & Stream Resolution ===");

  const query = "Nobody Downed More Israeli Planes - The Story of Saiful Azam";
  console.log(`Searching for: "${query}"...`);
  const tracks = await musicManager.search(query, "test-user-123", "Tester#0001");

  console.log(`Tracks found: ${tracks.length}`);
  if (tracks.length === 0) throw new Error("No tracks found!");

  const topTrack = tracks[0];
  console.log("Top Track:", {
    title: topTrack.title,
    url: topTrack.url,
    duration: topTrack.durationFormatted,
    author: topTrack.author,
  });

  console.log("\nTesting getDirectAudioUrl via yt-dlp...");
  const { getDirectAudioUrl } = require("../music/MusicManager");
  const directUrl = await getDirectAudioUrl(topTrack.url);
  if (!directUrl) throw new Error("Failed to extract direct audio URL via yt-dlp!");
  console.log("✅ Direct audio URL extracted successfully:", directUrl.slice(0, 80) + "...");

  console.log("\nTesting FFmpeg stream from direct audio URL...");
  const { spawn } = require("child_process");
  const ffmpegStatic = require("ffmpeg-static");
  const ffmpeg = spawn(ffmpegStatic, [
    "-reconnect", "1",
    "-reconnect_streamed", "1",
    "-reconnect_delay_max", "5",
    "-analyzeduration", "0",
    "-loglevel", "0",
    "-i", directUrl,
    "-f", "s16le",
    "-ar", "48000",
    "-ac", "2",
    "pipe:1"
  ], { stdio: ["ignore", "pipe", "ignore"] });

  let bytesReceived = 0;
  ffmpeg.stdout.on("data", (chunk: Buffer) => {
    bytesReceived += chunk.length;
  });

  await new Promise((resolve) => setTimeout(resolve, 3000));
  ffmpeg.kill();
  console.log(`Stream PCM data received in 3s: ${(bytesReceived / 1024).toFixed(1)} KB`);

  if (bytesReceived < 50_000) {
    throw new Error(`Insufficient stream data received: only ${bytesReceived} bytes!`);
  }

  console.log("\nTesting Autoplay recommendation (YouTube Mix / Related algorithm)...");
  const dummyQueue: any = {
    guildId: "dummy",
    tracks: [],
    history: [],
    currentTrack: topTrack,
  };

  const rec = await musicManager.getAutoplayRecommendation(dummyQueue, topTrack);
  if (rec) {
    console.log("✅ Autoplay recommended:", {
      title: rec.title,
      url: rec.url,
      duration: rec.durationFormatted,
      author: rec.author,
    });
  } else {
    console.warn("⚠️ No recommendation returned (fallback was used or empty).");
  }

  console.log("\n========================================================");
  console.log("🎉 MUSIC STREAMING VERIFICATION PASSED SUCCESSFULLY!");
  console.log("========================================================");
  process.exit(0);
}

testMusic().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
