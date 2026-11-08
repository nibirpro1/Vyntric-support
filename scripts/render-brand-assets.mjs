/**
 * Vyntric Support brand asset generator.
 *
 * Recreates the Vyntric "winged V" emblem as clean vectors (one definition,
 * mirrored programmatically so it is always symmetrical) and exports:
 *
 *   assets/vyntric-emblem.svg   white emblem, transparent background
 *   assets/vyntric-logo.svg     square avatar (dark red gradient + emblem)
 *   assets/vyntric-banner.svg   wide panel banner + VYNTRIC SUPPORT wordmark
 *   assets/png/*.png            raster versions (bot avatar, server icon, embeds)
 *
 * Run with: npm run brand:assets
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const assetsDir = path.join(root, "assets");
const pngDir = path.join(assetsDir, "png");

const SIZE = 512;
const CENTER = SIZE / 2;

/** Left half of the sigil: crown spikes + tapered wing blade. */
const LEFT_SHAPES = [
  [[30, 170], [76, 170], [2, 18]],
  [[94, 170], [130, 170], [84, 26]],
  [[148, 170], [186, 170], [210, 36]],
  [[34, 168], [124, 168], [CENTER, 296], [CENTER, 484]],
];

/** Centre piece: the downward spear between the two wings. */
const CENTER_SHAPES = [[[234, 174], [278, 174], [CENTER, 356]]];

const mirror = (points) => points.map(([x, y]) => [SIZE - x, y]);
const SHAPES = [...LEFT_SHAPES, ...LEFT_SHAPES.map(mirror), ...CENTER_SHAPES];

function emblemMarkup(fill = "#ffffff", opacity = 1) {
  return SHAPES.map(
    (points) =>
      `    <polygon points="${points.map((point) => point.join(",")).join(" ")}" fill="${fill}"${
        opacity < 1 ? ` opacity="${opacity}"` : ""
      }/>`
  ).join("\n");
}

const emblemSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
  <title>Vyntric Support emblem</title>
${emblemMarkup()}
</svg>
`;

const logoSize = 1024;
const logoSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${logoSize} ${logoSize}" width="${logoSize}" height="${logoSize}">
  <title>Vyntric Support logo</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3d050d"/>
      <stop offset="45%" stop-color="#8f0f1d"/>
      <stop offset="100%" stop-color="#c81e2e"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.35" cy="0.25" r="0.75">
      <stop offset="0%" stop-color="#ff6b7d" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#ff6b7d" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="#260306" flood-opacity="0.55"/>
    </filter>
  </defs>
  <rect width="${logoSize}" height="${logoSize}" rx="180" fill="url(#bg)"/>
  <rect width="${logoSize}" height="${logoSize}" rx="180" fill="url(#glow)"/>
  <g transform="translate(${(logoSize - 512 * 1.44) / 2}, ${(logoSize - 512 * 1.44) / 2}) scale(1.44)" filter="url(#shadow)">
${emblemMarkup()}
  </g>
</svg>
`;

const bannerW = 1200;
const bannerH = 400;
const bannerSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bannerW} ${bannerH}" width="${bannerW}" height="${bannerH}">
  <title>Vyntric Support banner</title>
  <defs>
    <linearGradient id="bbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1b0207"/>
      <stop offset="55%" stop-color="#6d0a15"/>
      <stop offset="100%" stop-color="#c81e2e"/>
    </linearGradient>
    <radialGradient id="bglow" cx="0.2" cy="0.3" r="0.8">
      <stop offset="0%" stop-color="#ff7a8a" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ff7a8a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${bannerW}" height="${bannerH}" fill="url(#bbg)"/>
  <rect width="${bannerW}" height="${bannerH}" fill="url(#bglow)"/>
  <g transform="translate(690, -80) scale(1.55)" opacity="0.09">
${emblemMarkup("#ffffff", 1)}
  </g>
  <g transform="translate(96, ${(bannerH - 512 * 0.62) / 2}) scale(0.62)">
${emblemMarkup()}
  </g>
  <g font-family="Segoe UI, Inter, Arial, sans-serif" fill="#ffffff">
    <text x="430" y="176" font-size="86" font-weight="700" letter-spacing="6">VYNTRIC</text>
    <text x="432" y="228" font-size="34" font-weight="500" letter-spacing="14" fill="#ffc2ca">SUPPORT</text>
  </g>
  <rect x="432" y="252" width="560" height="3" fill="#ff5c70" opacity="0.85"/>
  <text x="432" y="296" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="24" fill="#ffd9de" opacity="0.9">
    Premium ticket desk • Claim Reward • Team Application • Partnership
  </text>
</svg>
`;

function writeSvg(name, content) {
  const file = path.join(assetsDir, name);
  fs.writeFileSync(file, content, "utf8");
  console.log(`[brand] wrote ${path.relative(root, file)}`);
}

async function renderPng(svg, fileName, width, height) {
  const image = await loadImage(Buffer.from(svg, "utf8"));
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, width, height);
  const file = path.join(pngDir, fileName);
  fs.writeFileSync(file, canvas.toBuffer("image/png"));
  console.log(`[brand] wrote ${path.relative(root, file)} (${width}x${height})`);
}

async function main() {
  fs.mkdirSync(pngDir, { recursive: true });

  writeSvg("vyntric-emblem.svg", emblemSvg);
  writeSvg("vyntric-logo.svg", logoSvg);
  writeSvg("vyntric-banner.svg", bannerSvg);

  await renderPng(emblemSvg, "vyntric-emblem.png", 512, 512);
  await renderPng(logoSvg, "vyntric-logo.png", 1024, 1024);
  await renderPng(bannerSvg, "vyntric-banner.png", bannerW, bannerH);
}

main().catch((err) => {
  console.error("[brand] Failed to generate assets:", err);
  process.exit(1);
});
