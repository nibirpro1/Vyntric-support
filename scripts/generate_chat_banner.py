import os
import math
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

WIDTH = 800
HEIGHT = 260
FRAMES = 28
FPS = 18

WINDIR = os.environ.get("WINDIR", "C:\\Windows")
FONT_DIR = os.path.join(WINDIR, "Fonts")

font_main = ImageFont.truetype(os.path.join(FONT_DIR, "bahnschrift.ttf"), 46)
font_sub = ImageFont.truetype(os.path.join(FONT_DIR, "segoeuib.ttf"), 17)
font_tag = ImageFont.truetype(os.path.join(FONT_DIR, "segoeuib.ttf"), 12)

# Load emblem
emblem_path = os.path.join("assets", "png", "vyntric-emblem.png")
if os.path.exists(emblem_path):
    emblem_src = Image.open(emblem_path).convert("RGBA")
    # Resize emblem to fit nicely at top center
    emblem_src = emblem_src.resize((72, 72), Image.Resampling.LANCZOS)
else:
    emblem_src = None

# Pre-generate floating particles
random.seed(42)
particles = []
for _ in range(35):
    particles.append({
        "x": random.uniform(20, WIDTH - 20),
        "y": random.uniform(20, HEIGHT - 20),
        "speed_y": random.uniform(0.8, 2.2),
        "speed_x": random.uniform(-0.5, 0.5),
        "size": random.uniform(1.5, 3.8),
        "alpha": random.uniform(120, 240),
        "phase": random.uniform(0, math.pi * 2)
    })

frames = []

for frame_idx in range(FRAMES):
    progress = frame_idx / FRAMES
    t = progress * 2 * math.pi

    # 1. Base dark background with slight radial glow in center
    img = Image.new("RGBA", (WIDTH, HEIGHT), (8, 2, 5, 255))
    draw = ImageDraw.Draw(img)

    # Grid background lines with subtle pulse
    grid_alpha = int(22 + 8 * math.sin(t))
    grid_col = (180, 20, 35, grid_alpha)
    for x in range(0, WIDTH, 40):
        draw.line([(x, 0), (x, HEIGHT)], fill=grid_col, width=1)
    for y in range(0, HEIGHT, 32):
        draw.line([(0, y), (WIDTH, y)], fill=grid_col, width=1)

    # Center radial gradient glow
    glow_pulse = 0.85 + 0.15 * math.sin(t)
    glow_size = int(220 * glow_pulse)
    glow_img = Image.new("RGBA", (glow_size * 2, glow_size * 2), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_img)
    for r in range(glow_size, 0, -6):
        ra = int(45 * (1 - r / glow_size) * glow_pulse)
        glow_draw.ellipse(
            [(glow_size - r, glow_size - r), (glow_size + r, glow_size + r)],
            fill=(226, 25, 45, ra)
        )
    img.alpha_composite(glow_img, (WIDTH // 2 - glow_size, HEIGHT // 2 - glow_size - 10))

    # Tech border brackets (cyber aesthetic)
    bracket_col = (255, 60, 75, int(180 + 50 * math.sin(t)))
    # Top-left
    draw.line([(24, 20), (54, 20)], fill=bracket_col, width=2)
    draw.line([(24, 20), (24, 50)], fill=bracket_col, width=2)
    # Top-right
    draw.line([(WIDTH - 54, 20), (WIDTH - 24, 20)], fill=bracket_col, width=2)
    draw.line([(WIDTH - 24, 20), (WIDTH - 24, 50)], fill=bracket_col, width=2)
    # Bottom-left
    draw.line([(24, HEIGHT - 20), (54, HEIGHT - 20)], fill=bracket_col, width=2)
    draw.line([(24, HEIGHT - 20), (24, HEIGHT - 50)], fill=bracket_col, width=2)
    # Bottom-right
    draw.line([(WIDTH - 54, HEIGHT - 20), (WIDTH - 24, HEIGHT - 20)], fill=bracket_col, width=2)
    draw.line([(WIDTH - 24, HEIGHT - 20), (WIDTH - 24, HEIGHT - 50)], fill=bracket_col, width=2)

    # Top & bottom center tech indicators
    draw.line([(WIDTH // 2 - 140, 16), (WIDTH // 2 + 140, 16)], fill=(226, 25, 45, 120), width=1)
    draw.line([(WIDTH // 2 - 140, HEIGHT - 16), (WIDTH // 2 + 140, HEIGHT - 16)], fill=(226, 25, 45, 120), width=1)

    # Floating ember particles
    for p in particles:
        py = (p["y"] - p["speed_y"] * (frame_idx * 4)) % (HEIGHT - 30) + 15
        px = (p["x"] + math.sin(p["phase"] + t) * 6) % (WIDTH - 40) + 20
        pa = int(p["alpha"] * (0.6 + 0.4 * math.sin(p["phase"] + t)))
        pr = p["size"]
        draw.ellipse([(px - pr, py - pr), (px + pr, py + pr)], fill=(255, 80, 100, pa))

    # Draw Emblem with pulsing glow
    if emblem_src:
        emblem_x = (WIDTH - emblem_src.width) // 2
        emblem_y = 22
        # Subtle glow underneath emblem
        emblem_glow_r = int(48 * (0.9 + 0.1 * math.sin(t)))
        draw.ellipse(
            [(WIDTH // 2 - emblem_glow_r, emblem_y + emblem_src.height // 2 - emblem_glow_r),
             (WIDTH // 2 + emblem_glow_r, emblem_y + emblem_src.height // 2 + emblem_glow_r)],
            fill=(255, 50, 70, int(60 + 30 * math.sin(t)))
        )
        img.alpha_composite(emblem_src, (emblem_x, emblem_y))

    # Main text: "V Y N T R I C" with letter spacing
    main_text = "V Y N T R I C"
    bbox = font_main.getbbox(main_text)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (WIDTH - tw) // 2
    ty = 100

    # Red shadow / neon outer glow for main text
    for offset_x, offset_y in [(-2, 0), (2, 0), (0, -2), (0, 2), (-1, -1), (1, 1)]:
        draw.text((tx + offset_x, ty + offset_y), main_text, font=font_main, fill=(226, 25, 45, 180))

    # Shimmer light beam passing across main text
    shimmer_x = int(progress * (WIDTH + 200) - 100)
    # Base text color (bright white with slight red tint)
    draw.text((tx, ty), main_text, font=font_main, fill=(255, 245, 247, 255))

    # Shimmer highlight overlay
    shimmer_layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    shimmer_draw = ImageDraw.Draw(shimmer_layer)
    shimmer_draw.text((tx, ty), main_text, font=font_main, fill=(255, 255, 255, 255))
    # Mask shimmer with gradient bar
    beam_mask = Image.new("L", (WIDTH, HEIGHT), 0)
    beam_draw = ImageDraw.Draw(beam_mask)
    for bx in range(-45, 46):
        alpha_b = int(255 * (1 - abs(bx) / 45))
        beam_draw.line([(shimmer_x + bx, ty - 10), (shimmer_x + bx + 35, ty + th + 15)], fill=alpha_b, width=2)
    shimmer_layer.putalpha(beam_mask)
    img.alpha_composite(shimmer_layer)

    # Subtitle: "◆ WELCOME TO CHAT ◆"
    sub_text = "◆  W E L C O M E   T O   C H A T  ◆"
    s_bbox = font_sub.getbbox(sub_text)
    sw = s_bbox[2] - s_bbox[0]
    sx = (WIDTH - sw) // 2
    sy = 172

    # Diamond / neon pill behind subtitle
    pill_padding_x = 24
    pill_padding_y = 4
    pill_rect = [
        sx - pill_padding_x,
        sy - pill_padding_y,
        sx + sw + pill_padding_x,
        sy + s_bbox[3] - s_bbox[1] + pill_padding_y + 2
    ]
    draw.rounded_rectangle(
        pill_rect,
        radius=12,
        fill=(35, 6, 12, 200),
        outline=(226, 25, 45, int(180 + 60 * math.sin(t + 1))),
        width=1
    )
    draw.text((sx, sy), sub_text, font=font_sub, fill=(255, 120, 140, 255))

    # Tagline: "• SAY HELLO & VIBE WITH THE COMMUNITY •"
    tag_text = "•  S A Y   H E L L O   &   V I B E   W I T H   U S  •"
    t_bbox = font_tag.getbbox(tag_text)
    tw2 = t_bbox[2] - t_bbox[0]
    tx2 = (WIDTH - tw2) // 2
    ty2 = 216
    draw.text((tx2, ty2), tag_text, font=font_tag, fill=(200, 160, 170, 200))

    # Convert to RGB for GIF palette
    frames.append(img.convert("RGB"))

# Save animated GIF
out_path = os.path.join("assets", "banners", "vyntric-chat-welcome.gif")
os.makedirs(os.path.dirname(out_path), exist_ok=True)

# Quantize each frame with adaptive palette
quantized_frames = []
palette_img = frames[0].quantize(colors=96)
for f in frames:
    q = f.quantize(palette=palette_img, dither=Image.Dither.FLOYDSTEINBERG)
    quantized_frames.append(q)

quantized_frames[0].save(
    out_path,
    save_all=True,
    append_images=quantized_frames[1:],
    duration=int(1000 / FPS),
    loop=0,
    optimize=True
)

file_size_kb = os.path.getsize(out_path) / 1024
print(f"Successfully generated {out_path} ({file_size_kb:.1f} KB, {FRAMES} frames @ {FPS} fps)")
