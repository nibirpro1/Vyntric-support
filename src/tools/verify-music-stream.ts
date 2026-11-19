import { musicManager } from "../music/MusicManager";
import { Ytdl } from "@distube/ytdl-core";

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

  console.log("\nTesting @distube/ytdl-core direct audio download...");
  const ytdl = new Ytdl();
  const stream = await ytdl.download(topTrack.url, {
    filter: { hasAudio: true, hasVideo: false },
    quality: "highestaudio",
  });

  let bytesReceived = 0;
  stream.on("data", (chunk: Buffer) => {
    bytesReceived += chunk.length;
  });

  await new Promise((resolve) => setTimeout(resolve, 3000));
  console.log(`Stream data received in 3s: ${(bytesReceived / 1024).toFixed(1)} KB`);

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
