import os
import math
import random
from PIL import Image, ImageChops, ImageFilter, ImageDraw

SIZE = 512
TOTAL_FRAMES = 46
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

# Extract outline mask for electric trace effect
eroded = emblem_mask.filter(ImageFilter.MinFilter(3))
outline_mask = ImageChops.subtract(emblem_mask, eroded)

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
    # 0-3 (0.2s): Ignition spark at bottom sword tip
    # 4-11 (0.45s): Electric outline trace upward along the spikes
    # 12-14 (0.15s): Core energy surge flash-filling into solid white
    # 15-17 (0.15s): Expanding outward shockwave blast
    # 18-40 (1.3s - 23 FULL FRAMES): SHOW FULL SOLID WHITE LOGO (holding & glowing)
    # 41-45 (0.25s): Energy dissolve loop reset

    if i < 4:
        # Pre-ignition spark at dagger tip (255, 421)
        spark_scale = (i + 1) / 4.0
        spark_r = int(7 * spark_scale)
        s_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        s_draw = ImageDraw.Draw(s_layer)
        s_draw.ellipse([(255 - spark_r, 421 - spark_r), (255 + spark_r, 421 + spark_r)], fill=(255, 30, 70, int(220 * spark_scale)))
        s_draw.ellipse([(255 - spark_r // 2, 421 - spark_r // 2), (255 + spark_r // 2, 421 + spark_r // 2)], fill=(255, 255, 255, int(255 * spark_scale)))
        frame.alpha_composite(s_layer)

    elif 4 <= i <= 11:
        # Trace from bottom (y=425) up to horns (y=40)
        trace_t = (i - 4) / 7.0  # 0.0 to 1.0
        reach_y = int(425 - trace_t * (425 - 40))

        # Wipe mask for outline (from bottom up to reach_y)
        t_mask = Image.new("L", (SIZE, SIZE), 0)
        t_draw = ImageDraw.Draw(t_mask)
        t_draw.rectangle([(0, reach_y), (SIZE, SIZE)], fill=255)

        curr_outline = ImageChops.multiply(outline_mask, t_mask)
        curr_glow = curr_outline.filter(ImageFilter.GaussianBlur(radius=5))

        # Crimson glow around the traced outline
        glow_layer = Image.new("RGBA", (SIZE, SIZE), (255, 30, 60, 240))
        glow_layer.putalpha(curr_glow)
        frame.alpha_composite(glow_layer)

        # White core of the traced outline
        core_layer = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 255))
        core_layer.putalpha(curr_outline)
        frame.alpha_composite(core_layer)

        # Tracing head sparks at reach_y
        sp_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        sp_draw = ImageDraw.Draw(sp_layer)
        beam_w = int(40 + 70 * math.sin(trace_t * math.pi))
        sp_draw.line([(255 - beam_w, reach_y), (255 + beam_w, reach_y)], fill=(255, 40, 80, 160), width=4)
        sp_draw.line([(255 - beam_w * 0.6, reach_y), (255 + beam_w * 0.6, reach_y)], fill=(255, 255, 255, 240), width=2)
        frame.alpha_composite(sp_layer)

    elif 12 <= i <= 14:
        # Radial Surge: Energy floods from core outward to fill the emblem
        fill_t = (i - 12) / 2.0  # 0.0, 0.5, 1.0
        fill_r = int(60 + fill_t * 260)

        r_mask = Image.new("L", (SIZE, SIZE), 0)
        r_draw = ImageDraw.Draw(r_mask)
        r_draw.ellipse([(255 - fill_r, 230 - fill_r), (255 + fill_r, 230 + fill_r)], fill=255)

        curr_filled = ImageChops.multiply(emblem_mask, r_mask)

        # Expanding aura
        f_blur = curr_filled.filter(ImageFilter.GaussianBlur(radius=18))
        f_aura = ImageChops.subtract(f_blur, emblem_mask)
        a_layer = Image.new("RGBA", (SIZE, SIZE), (255, 30, 60, 255))
        a_layer.putalpha(f_aura)
        frame.alpha_composite(a_layer)

        # Pure solid white emblem filled region
        w_curr = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 255))
        w_curr.putalpha(curr_filled)
        frame.alpha_composite(w_curr)

        # Expanding white flash edge
        ring_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        ring_draw = ImageDraw.Draw(ring_layer)
        ring_draw.ellipse([(255 - fill_r, 230 - fill_r), (255 + fill_r, 230 + fill_r)], outline=(255, 255, 255, 240), width=3)
        ring_alpha = ImageChops.multiply(ring_layer.getchannel("A"), emblem_mask)
        ring_layer.putalpha(ring_alpha)
        frame.alpha_composite(ring_layer)

    elif 15 <= i <= 17:
        # Shockwave blast into background
        sw_t = (i - 15) / 2.0  # 0.0 to 1.0
        sw_r = int(90 + sw_t * 200)
        sw_alpha = int(240 * (1.0 - sw_t))

        sw_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        sw_draw = ImageDraw.Draw(sw_layer)
        sw_draw.ellipse([(255 - sw_r, 230 - sw_r), (255 + sw_r, 230 + sw_r)], outline=(255, 40, 70, sw_alpha), width=4)
        frame.alpha_composite(sw_layer)

        # Aura
        a_layer = Image.new("RGBA", (SIZE, SIZE), (255, 30, 60, 255))
        a_layer.putalpha(aura_mid)
        frame.alpha_composite(a_layer)

        # Full white emblem
        frame.alpha_composite(white_emblem)

    elif 18 <= i <= 40:
        # THE FULL LOGO SHOWCASE (HOLD & SHINE) - 23 FULL FRAMES!
        hold_idx = i - 18
        hold_total = 40 - 18
        hold_t = (hold_idx / hold_total) * 2 * math.pi
        pulse = 0.5 + 0.5 * math.sin(hold_t)

        # 1. Radiant exterior crimson breathing aura
        wide_intensity = int(85 + 75 * pulse)
        wide_img = Image.new("RGBA", (SIZE, SIZE), (255, 10, 40, 255))
        wide_img.putalpha(aura_wide.point(lambda p: int(p * (wide_intensity / 255))))
        frame.alpha_composite(wide_img)

        # 2. Bright ruby mid aura
        mid_intensity = int(120 + 90 * pulse)
        mid_img = Image.new("RGBA", (SIZE, SIZE), (255, 25, 60, 255))
        mid_img.putalpha(aura_mid.point(lambda p: int(p * (mid_intensity / 255))))
        frame.alpha_composite(mid_img)

        # 3. Electric edge pulse
        tight_intensity = int(150 + 105 * pulse)
        tight_img = Image.new("RGBA", (SIZE, SIZE), (255, 70, 100, 255))
        tight_img.putalpha(aura_tight.point(lambda p: int(p * (tight_intensity / 255))))
        frame.alpha_composite(tight_img)

        # 4. SOLID PRISTINE WHITE EMBLEM (100% #FFFFFF)
        frame.alpha_composite(white_emblem)

        # 5. Dagger tip diamond sparkle at peak of hold (frames 26-32)
        if 26 <= i <= 32:
            st = (i - 26) / 6.0
            s_scale = math.sin(st * math.pi)
            slen = int(15 * s_scale)
            if slen > 0:
                glint_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
                g_draw = ImageDraw.Draw(glint_layer)
                gx, gy = 255, 421
                g_draw.line([(gx - slen, gy), (gx + slen, gy)], fill=(255, 255, 255, int(245 * s_scale)), width=2)
                g_draw.line([(gx, gy - slen), (gx, gy + slen)], fill=(255, 255, 255, int(245 * s_scale)), width=2)
                dlen = int(slen * 0.5)
                g_draw.line([(gx - dlen, gy - dlen), (gx + dlen, gy + dlen)], fill=(255, 255, 255, int(190 * s_scale)), width=1)
                g_draw.line([(gx - dlen, gy + dlen), (gx + dlen, gy - dlen)], fill=(255, 255, 255, int(190 * s_scale)), width=1)
                frame.alpha_composite(glint_layer)

    else:
        # Frames 41-45: Smooth energy dissolve fade back to frame 0
        dissolve_t = (i - 41) / 4.0
        dissolve_alpha = int(255 * (1.0 - dissolve_t))

        fade_aura = aura_mid.point(lambda p: int(p * (dissolve_alpha / 255)))
        a_img = Image.new("RGBA", (SIZE, SIZE), (255, 25, 60, 255))
        a_img.putalpha(fade_aura)
        frame.alpha_composite(a_img)

        fade_mask = emblem_mask.point(lambda p: int(p * (dissolve_alpha / 255)))
        w_img = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 255))
        w_img.putalpha(fade_mask)
        frame.alpha_composite(w_img)

    frames.append(frame.convert("RGB"))

# 5. Build high-quality 256-color palette from key frames
all_key = Image.new("RGB", (SIZE * 2, SIZE * 2))
all_key.paste(frames[7], (0, 0))
all_key.paste(frames[13], (SIZE, 0))
all_key.paste(frames[28], (0, SIZE))
all_key.paste(frames[43], (SIZE, SIZE))

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
