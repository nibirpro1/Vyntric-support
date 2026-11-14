import os
import math
import random
from PIL import Image, ImageChops, ImageFilter, ImageDraw

SIZE = 512
FRAMES = 28
FPS = 20

# 1. Load original pristine uploaded image
src_path = os.path.join("assets", "vyntric-avatar.jpg")
if not os.path.exists(src_path):
    raise FileNotFoundError(f"{src_path} not found!")

orig_img = Image.open(src_path).convert("RGB")
base_512 = orig_img.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
pix = base_512.load()

# 2. Extract pixel-perfect mask for the white emblem
emblem_mask = Image.new("L", (SIZE, SIZE), 0)
mask_pix = emblem_mask.load()
for y in range(SIZE):
    for x in range(SIZE):
        r, g, b = pix[x, y]
        score = (g + b) / 2
        if score > 150:
            mask_pix[x, y] = 255
        elif score > 25:
            mask_pix[x, y] = int(255 * (score - 25) / 125)

# 100% Solid Pristine Pure White Emblem Layer (ensures zero discoloration on the emblem)
white_emblem = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 255))
white_emblem.putalpha(emblem_mask)

# 3. Precompute exterior-only radiant aura layers
blur_wide = emblem_mask.filter(ImageFilter.GaussianBlur(radius=28))
blur_mid = emblem_mask.filter(ImageFilter.GaussianBlur(radius=14))
blur_tight = emblem_mask.filter(ImageFilter.GaussianBlur(radius=4))

# Subtract emblem mask from blur so all glow is STRICTLY EXTERIOR
aura_wide = ImageChops.subtract(blur_wide, emblem_mask)
aura_mid = ImageChops.subtract(blur_mid, emblem_mask)
aura_tight = ImageChops.subtract(blur_tight, emblem_mask)

# 4. Background floating dark embers
random.seed(42)
particles = []
for _ in range(24):
    particles.append({
        "x": random.uniform(30, SIZE - 30),
        "y": random.uniform(30, SIZE - 30),
        "speed_y": random.uniform(1.2, 2.5),
        "size": random.uniform(1.5, 3.2),
        "alpha": random.uniform(120, 240),
        "phase": random.uniform(0, math.pi * 2),
    })

frames = []
for i in range(FRAMES):
    t = (i / FRAMES) * 2 * math.pi
    pulse = 0.5 + 0.5 * math.sin(t)
    heartbeat = 0.6 * math.sin(t) + 0.4 * math.sin(2 * t)
    hb_norm = 0.5 + 0.5 * heartbeat

    # Base dark red textured background
    frame = base_512.copy().convert("RGBA")

    # Layer 1: Floating background embers
    ember_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    ember_draw = ImageDraw.Draw(ember_layer)
    for p in particles:
        py = (p["y"] - p["speed_y"] * (i * 5)) % (SIZE - 30) + 15
        px = (p["x"] + math.sin(p["phase"] + t) * 7) % (SIZE - 30) + 15
        p_alpha = int(p["alpha"] * (0.5 + 0.5 * math.sin(p["phase"] + t)))
        pr = p["size"]
        ember_draw.ellipse(
            [(px - pr, py - pr), (px + pr, py + pr)],
            fill=(255, 40, 70, p_alpha)
        )
        ember_draw.ellipse(
            [(px - pr * 0.5, py - pr * 0.5), (px + pr * 0.5, py + pr * 0.5)],
            fill=(255, 230, 240, p_alpha)
        )
    frame.alpha_composite(ember_layer)

    # Layer 2: Exterior deep crimson breathing aura
    wide_intensity = int(80 + 75 * hb_norm)
    wide_img = Image.new("RGBA", (SIZE, SIZE), (255, 10, 40, 255))
    wide_mask = aura_wide.point(lambda p: int(p * (wide_intensity / 255)))
    wide_img.putalpha(wide_mask)
    frame.alpha_composite(wide_img)

    # Layer 3: Exterior bright ruby mid aura
    mid_intensity = int(120 + 90 * pulse)
    mid_img = Image.new("RGBA", (SIZE, SIZE), (255, 25, 60, 255))
    mid_mask = aura_mid.point(lambda p: int(p * (mid_intensity / 255)))
    mid_img.putalpha(mid_mask)
    frame.alpha_composite(mid_img)

    # Layer 4: Exterior tight electric neon edge pulse
    tight_intensity = int(150 + 105 * pulse)
    tight_img = Image.new("RGBA", (SIZE, SIZE), (255, 70, 100, 255))
    tight_mask = aura_tight.point(lambda p: int(p * (tight_intensity / 255)))
    tight_img.putalpha(tight_mask)
    frame.alpha_composite(tight_img)

    # Layer 5: SOLID PRISTINE WHITE EMBLEM ON TOP
    # 100% razor sharp, pure white #FFFFFF with zero pink/red tint
    frame.alpha_composite(white_emblem)

    # Layer 6: Dagger tip diamond sparkle at (255, 421) during pulse peak
    if 12 <= i <= 20:
        glint_t = (i - 12) / 8
        glint_scale = math.sin(glint_t * math.pi)
        glint_len = int(14 * glint_scale)
        gx, gy = 255, 421
        if glint_len > 0:
            glint_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
            g_draw = ImageDraw.Draw(glint_layer)
            g_draw.line([(gx - glint_len, gy), (gx + glint_len, gy)], fill=(255, 255, 255, int(245 * glint_scale)), width=2)
            g_draw.line([(gx, gy - glint_len), (gx, gy + glint_len)], fill=(255, 255, 255, int(245 * glint_scale)), width=2)
            d_len = int(glint_len * 0.5)
            if d_len > 0:
                g_draw.line([(gx - d_len, gy - d_len), (gx + d_len, gy + d_len)], fill=(255, 255, 255, int(190 * glint_scale)), width=1)
                g_draw.line([(gx - d_len, gy + d_len), (gx + d_len, gy - d_len)], fill=(255, 255, 255, int(190 * glint_scale)), width=1)
            frame.alpha_composite(glint_layer)

    frames.append(frame.convert("RGB"))

# 5. Build high-quality 256-color palette from multiple keyframes
all_key = Image.new("RGB", (SIZE * 2, SIZE * 2))
all_key.paste(frames[0], (0, 0))
all_key.paste(frames[7], (SIZE, 0))
all_key.paste(frames[14], (0, SIZE))
all_key.paste(frames[21], (SIZE, SIZE))

palette_img = all_key.quantize(colors=256, method=Image.Quantize.FASTOCTREE)

quantized = []
for f in frames:
    q = f.quantize(palette=palette_img, dither=Image.Dither.NONE)
    quantized.append(q)

out_gif = os.path.join("assets", "vyntric-avatar.gif")
os.makedirs(os.path.dirname(out_gif), exist_ok=True)
quantized[0].save(
    out_gif,
    save_all=True,
    append_images=quantized[1:],
    duration=int(1000 / FPS),
    loop=0,
    optimize=True
)

size_kb = os.path.getsize(out_gif) / 1024
print(f"Successfully generated {out_gif} ({size_kb:.1f} KB, {FRAMES} frames @ {FPS} fps)")
