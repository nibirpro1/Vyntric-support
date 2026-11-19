import { musicManager } from "../music/MusicManager";

async function verify() {
  console.log("==================================================");
  console.log("   ANY LINK MUSIC RESOLVER VERIFICATION SUITE     ");
  console.log("==================================================\n");

  const testCases = [
    {
      name: "1. YouTube Video",
      query: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      expectedPlatform: "youtube",
    },
    {
      name: "2. Spotify Track",
      query: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
      expectedPlatform: "spotify",
    },
    {
      name: "3. Spotify Playlist",
      query: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
      expectedPlatform: "spotify",
    },
    {
      name: "4. Apple Music Track",
      query: "https://music.apple.com/us/album/blinding-lights/1499378108?i=1499378607",
      expectedPlatform: "apple",
    },
    {
      name: "5. SoundCloud Track",
      query: "https://soundcloud.com/octobersveryown/drake-gods-plan",
      expectedPlatform: "soundcloud",
    },
    {
      name: "6. Deezer Track",
      query: "https://www.deezer.com/track/3135556",
      expectedPlatform: "deezer",
    },
    {
      name: "7. Direct Audio Stream (.mp3)",
      query: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      expectedPlatform: "url",
    },
    {
      name: "8. Plain Text Search",
      query: "Never Gonna Give You Up Rick Astley",
      expectedPlatform: "youtube",
    },
  ];

  let passed = 0;

  for (const tc of testCases) {
    try {
      console.log(`[TEST] ${tc.name}: ${tc.query.slice(0, 70)}...`);
      const startTime = Date.now();
      const tracks = await musicManager.search(tc.query, "test_user_id", "TestUser#0001");
      const elapsed = Date.now() - startTime;

      if (!tracks || tracks.length === 0) {
        console.error(`  ❌ FAILED: Returned 0 tracks!\n`);
        continue;
      }

      const first = tracks[0];
      const validPlatform = first.platform === tc.expectedPlatform;
      console.log(`  ✅ SUCCESS (${elapsed}ms):`);
      console.log(`     - Total Tracks Extracted: ${tracks.length}`);
      console.log(`     - Title: "${first.title}"`);
      console.log(`     - Artist: "${first.author}"`);
      console.log(`     - Platform: ${first.platform}`);
      console.log(`     - Playable URL: ${first.url}`);
      console.log(`     - Original URL: ${first.originalUrl || "None"}\n`);

      if (validPlatform) {
        passed++;
      } else {
        console.warn(`  ⚠️ Platform mismatch: expected ${tc.expectedPlatform}, got ${first.platform}`);
      }
    } catch (err: any) {
      console.error(`  ❌ EXCEPTION: ${err.message}\n`);
    }
  }

  console.log("==================================================");
  console.log(`RESULTS: ${passed}/${testCases.length} PASSED`);
  console.log("==================================================");

  if (passed === testCases.length) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

verify();
