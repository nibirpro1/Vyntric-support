import os
import math
import random
from PIL import Image, ImageChops, ImageFilter, ImageDraw

SIZE = 512
TOTAL_FRAMES = 42
FPS = 18

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

# Solid binary mask dilated by 3px to guarantee 100% boundary isolation
# Zero red/crimson pixels can ever touch the white emblem or its antialiased edges
solid_mask = emblem_mask.point(lambda p: 255 if p > 40 else 0)
dilated_mask = solid_mask.filter(ImageFilter.MaxFilter(3))

# 100% Solid Pristine Pure White Emblem Layer (ensures WHITE IS WHITE ALWAYS)
white_emblem = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 255))
white_emblem.putalpha(emblem_mask)

# 3. Precompute exterior-only radiant aura layers (strictly outside dilated mask)
blur_wide = emblem_mask.filter(ImageFilter.GaussianBlur(radius=30))
blur_mid = emblem_mask.filter(ImageFilter.GaussianBlur(radius=15))
blur_tight = emblem_mask.filter(ImageFilter.GaussianBlur(radius=5))

aura_wide = ImageChops.subtract(blur_wide, dilated_mask)
aura_mid = ImageChops.subtract(blur_mid, dilated_mask)
aura_tight = ImageChops.subtract(blur_tight, dilated_mask)

# 4. Background floating dark embers
random.seed(1337)
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
for i in range(TOTAL_FRAMES):
    # Base dark red textured background
    frame = base_512.copy().convert("RGBA")

    # Layer 1: Floating background embers
    ember_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    ember_draw = ImageDraw.Draw(ember_layer)
    for p in particles:
        py = (p["y"] - p["speed_y"] * (i * 5)) % (SIZE - 30) + 15
        px = (p["x"] + math.sin(p["phase"] + (i / TOTAL_FRAMES) * 2 * math.pi) * 7) % (SIZE - 30) + 15
        p_alpha = int(p["alpha"] * (0.5 + 0.5 * math.sin(p["phase"] + i * 0.3)))
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

    # TIMELINE STRUCTURE:
    # 0-12 (0.7s): Phase 1 - Gentle resting breathing aura (calm)
    # 13-22 (0.55s): Phase 2 - Energy charge-up & spark building at dagger tip
    # 23-28 (0.35s): Phase 3 - Shockwave blast eruption rippling into background
    # 29-41 (0.7s): Phase 4 - FULL LOGO GLORY HOLD (pure white, breathing aura, diamond sparkle)

    if i <= 12:
        # Phase 1: Calm breathing aura
        pulse = 0.5 + 0.5 * math.sin((i / 12) * math.pi)
        w_int = int(70 + 40 * pulse)
        m_int = int(90 + 50 * pulse)
        t_int = int(100 + 60 * pulse)
    elif 13 <= i <= 22:
        # Phase 2: Charging up exterior aura
        charge_t = (i - 13) / 9.0
        w_int = int(110 + 90 * charge_t)
        m_int = int(140 + 100 * charge_t)
        t_int = int(160 + 95 * charge_t)
    elif 23 <= i <= 28:
        # Phase 3: Shockwave eruption in the background
        blast_t = (i - 23) / 5.0
        w_int = int(200 - 80 * blast_t)
        m_int = int(240 - 100 * blast_t)
        t_int = int(255 - 80 * blast_t)

        # Shockwave rings expanding into background behind emblem
        sw_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        sw_draw = ImageDraw.Draw(sw_layer)
        # Ring 1
        r1 = int(70 + blast_t * 220)
        a1 = int(240 * (1.0 - blast_t))
        sw_draw.ellipse([(255 - r1, 230 - r1), (255 + r1, 230 + r1)], outline=(255, 30, 60, a1), width=5)
        # Ring 2 (trailing)
        if blast_t > 0.3:
            r2 = int(50 + (blast_t - 0.3) / 0.7 * 180)
            a2 = int(200 * (1.0 - (blast_t - 0.3) / 0.7))
            sw_draw.ellipse([(255 - r2, 230 - r2), (255 + r2, 230 + r2)], outline=(255, 70, 100, a2), width=3)
        frame.alpha_composite(sw_layer)
    else:
        # Phase 4: Full logo hold with proud breathing aura
        hold_t = (i - 29) / 12.0
        pulse = 0.5 + 0.5 * math.sin(hold_t * 2 * math.pi)
        w_int = int(90 + 60 * pulse)
        m_int = int(120 + 70 * pulse)
        t_int = int(140 + 80 * pulse)

    # Composite aura layers (strictly exterior!)
    wide_img = Image.new("RGBA", (SIZE, SIZE), (255, 10, 40, 255))
    wide_img.putalpha(aura_wide.point(lambda p: int(p * (w_int / 255))))
    frame.alpha_composite(wide_img)

    mid_img = Image.new("RGBA", (SIZE, SIZE), (255, 25, 60, 255))
    mid_img.putalpha(aura_mid.point(lambda p: int(p * (m_int / 255))))
    frame.alpha_composite(mid_img)

    tight_img = Image.new("RGBA", (SIZE, SIZE), (255, 70, 100, 255))
    tight_img.putalpha(aura_tight.point(lambda p: int(p * (t_int / 255))))
    frame.alpha_composite(tight_img)

    # Layer 2: PURE SOLID WHITE EMBLEM - ALWAYS ON TOP AT 100% OPACITY!
    # WHITE IS WHITE ALWAYS! NEVER TINTED, NEVER DIMMED, NEVER OVERLAID WITH RED!
    frame.alpha_composite(white_emblem)

    # Layer 3: Clean Pure White Specular Diamond Sparkle on dagger tip
    # During charging (18-22) and during hold (32-37)
    sparkle_scale = 0.0
    if 18 <= i <= 22:
        sparkle_scale = (i - 18) / 4.0
    elif 32 <= i <= 37:
        st = (i - 32) / 5.0
        sparkle_scale = math.sin(st * math.pi)

    if sparkle_scale > 0:
        slen = int(16 * sparkle_scale)
        if slen > 0:
            glint_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
            g_draw = ImageDraw.Draw(glint_layer)
            gx, gy = 255, 421
            g_draw.line([(gx - slen, gy), (gx + slen, gy)], fill=(255, 255, 255, int(255 * sparkle_scale)), width=2)
            g_draw.line([(gx, gy - slen), (gx, gy + slen)], fill=(255, 255, 255, int(255 * sparkle_scale)), width=2)
            dlen = int(slen * 0.5)
            if dlen > 0:
                g_draw.line([(gx - dlen, gy - dlen), (gx + dlen, gy + dlen)], fill=(255, 255, 255, int(200 * sparkle_scale)), width=1)
                g_draw.line([(gx - dlen, gy + dlen), (gx + dlen, gy - dlen)], fill=(255, 255, 255, int(200 * sparkle_scale)), width=1)
            frame.alpha_composite(glint_layer)

    frames.append(frame.convert("RGB"))

# 5. Build high-quality 256-color palette from key frames
all_key = Image.new("RGB", (SIZE * 2, SIZE * 2))
all_key.paste(frames[0], (0, 0))
all_key.paste(frames[20], (SIZE, 0))
all_key.paste(frames[25], (0, SIZE))
all_key.paste(frames[35], (SIZE, SIZE))

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
print(f"Successfully generated {out_gif} ({size_kb:.1f} KB, {TOTAL_FRAMES} frames @ {FPS} fps)")
