const fs = require("fs");
const path = require("path");
const https = require("https");

const isWin = process.platform === "win32";
const binDir = path.resolve(__dirname, "..", "bin");
const binaryName = isWin ? "yt-dlp.exe" : "yt-dlp";
const binaryPath = path.join(binDir, binaryName);

const downloadUrl = isWin
  ? "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
  : "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function chmodBinary() {
  if (!isWin && fs.existsSync(binaryPath)) {
    try {
      fs.chmodSync(binaryPath, 0o755);
      console.log(`[ensure-ytdlp] Marked ${binaryPath} as executable (0755).`);
    } catch (err) {
      console.warn(`[ensure-ytdlp] Failed to chmod ${binaryPath}:`, err.message);
    }
  }
}

function downloadBinary(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`[ensure-ytdlp] Downloading yt-dlp from ${url}...`);
    const file = fs.createWriteStream(dest, { mode: 0o755 });

    function get(reqUrl) {
      https
        .get(reqUrl, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return get(res.headers.location);
          }
          if (res.statusCode !== 200) {
            return reject(new Error(`Download failed with HTTP ${res.statusCode}`));
          }
          res.pipe(file);
          file.on("finish", () => {
            file.close(() => resolve());
          });
        })
        .on("error", (err) => {
          fs.unlink(dest, () => {});
          reject(err);
        });
    }

    get(url);
  });
}

async function main() {
  ensureDir(binDir);

  if (fs.existsSync(binaryPath)) {
    const stats = fs.statSync(binaryPath);
    if (stats.size > 1_000_000) {
      console.log(`[ensure-ytdlp] Valid yt-dlp binary already present (${(stats.size / (1024 * 1024)).toFixed(2)} MB).`);
      chmodBinary();
      return;
    }
    console.warn(`[ensure-ytdlp] Existing binary is too small (${stats.size} bytes), re-downloading...`);
  }

  try {
    await downloadBinary(downloadUrl, binaryPath);
    console.log(`[ensure-ytdlp] Download complete: ${binaryPath}`);
    chmodBinary();
  } catch (err) {
    console.warn(`[ensure-ytdlp] Automatic download failed: ${err.message}. yt-dlp from PATH will be used if available.`);
  }
}

main().catch((err) => {
  console.error("[ensure-ytdlp] Unexpected error:", err);
});
