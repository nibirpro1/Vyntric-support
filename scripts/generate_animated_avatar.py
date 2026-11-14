import os
import math
import random
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

SIZE = 512
FRAMES = 24
FPS = 16

# 1. Load original uploaded image
src_path = os.path.join("assets", "vyntric-avatar.jpg")
if not os.path.exists(src_path):
    raise FileNotFoundError(f"{src_path} not found!")

orig_img = Image.open(src_path).convert("RGB")
base_512 = orig_img.resize((SIZE, SIZE), Image.Resampling.LANCZOS)

# 2. Extract accurate emblem mask (white pixels: high G and B)
w, h = base_512.size
orig_pixels = base_512.load()

emblem_mask = Image.new("L", (SIZE, SIZE), 0)
mask_pixels = emblem_mask.load()

for y in range(h):
    for x in range(w):
        r, g, b = orig_pixels[x, y]
        # Crisp white emblem has high G and B (red background has g, b < 60)
        if g > 130 and b > 130:
            mask_pixels[x, y] = 255
        elif g > 80 and b > 80:
            # Soft antialiased edge
            alpha = int(255 * (min(g, b) - 80) / 50)
            mask_pixels[x, y] = max(0, min(255, alpha))

# Pre-generate glowing aura layers
aura_blur = emblem_mask.filter(ImageFilter.GaussianBlur(radius=14))
inner_blur = emblem_mask.filter(ImageFilter.GaussianBlur(radius=6))

# Pre-generate floating embers/particles
random.seed(1337)
particles = []
for _ in range(26):
    particles.append({
        "x": random.uniform(30, SIZE - 30),
        "y": random.uniform(30, SIZE - 30),
        "speed_y": random.uniform(1.2, 2.5),
        "size": random.uniform(1.8, 3.8),
        "alpha": random.uniform(140, 255),
        "phase": random.uniform(0, math.pi * 2),
    })

frames = []

for frame_idx in range(FRAMES):
    progress = frame_idx / FRAMES
    t = progress * 2 * math.pi

    # Start with base image
    frame = base_512.copy().convert("RGBA")

    # 1. Floating ember particles (behind & around emblem)
    ember_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    ember_draw = ImageDraw.Draw(ember_layer)
    for p in particles:
        py = (p["y"] - p["speed_y"] * (frame_idx * 5)) % (SIZE - 40) + 20
        px = (p["x"] + math.sin(p["phase"] + t) * 8) % (SIZE - 40) + 20
        pa = int(p["alpha"] * (0.6 + 0.4 * math.sin(p["phase"] + t)))
        pr = p["size"]
        # Ember with glowing soft outer rim
        ember_draw.ellipse(
            [(px - pr - 1, py - pr - 1), (px + pr + 1, py + pr + 1)],
            fill=(255, 60, 80, pa // 2)
        )
        ember_draw.ellipse(
            [(px - pr, py - pr), (px + pr, py + pr)],
            fill=(255, 200, 210, pa)
        )

    frame.alpha_composite(ember_layer)

    # 2. Pulsing Neon Aura Glow around emblem
    glow_pulse = 0.5 + 0.5 * math.sin(t)
    aura_intensity = int(80 + 70 * glow_pulse)
    aura_img = Image.new("RGBA", (SIZE, SIZE), (255, 30, 60, 255))
    # Multiply aura_blur by intensity
    aura_mask = aura_blur.point(lambda p: int(p * (aura_intensity / 255)))
    aura_img.putalpha(aura_mask)
    frame.alpha_composite(aura_img)

    # 3. Inner neon core glow
    inner_intensity = int(120 + 80 * glow_pulse)
    inner_img = Image.new("RGBA", (SIZE, SIZE), (255, 80, 110, 255))
    inner_mask = inner_blur.point(lambda p: int(p * (inner_intensity / 255)))
    inner_img.putalpha(inner_mask)
    frame.alpha_composite(inner_img)

    # 4. Diagonal Metallic Light Sweep (Shimmer) across the emblem
    shimmer_x = int(progress * (SIZE + 240) - 120)
    shimmer_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    shimmer_draw = ImageDraw.Draw(shimmer_layer)

    beam_width = 38
    for bx in range(-beam_width, beam_width + 1):
        alpha_factor = 1 - abs(bx) / beam_width
        beam_alpha = int(220 * (alpha_factor ** 1.5))
        x1 = shimmer_x + bx
        y1 = 0
        x2 = shimmer_x + bx - 140
        y2 = SIZE
        shimmer_draw.line([(x1, y1), (x2, y2)], fill=(255, 255, 255, beam_alpha), width=2)

    # Mask shimmer strictly to the emblem shape
    shimmer_alpha = shimmer_layer.getchannel("A")
    combined_mask = Image.new("L", (SIZE, SIZE), 0)
    s_bytes = shimmer_alpha.tobytes()
    e_bytes = emblem_mask.tobytes()
    comb_bytes = bytes([min(s, e) for s, e in zip(s_bytes, e_bytes)])
    combined_mask.frombytes(comb_bytes)

    shimmer_layer.putalpha(combined_mask)
    frame.alpha_composite(shimmer_layer)

    # 5. Subtle corner vignette breathing
    vignette = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    v_draw = ImageDraw.Draw(vignette)
    v_alpha = int(35 + 20 * math.sin(t + math.pi))
    v_draw.rectangle([(0, 0), (SIZE, SIZE)], outline=(20, 0, 5, v_alpha), width=12)
    frame.alpha_composite(vignette)

    frames.append(frame.convert("RGB"))

# 3. Export optimized animated GIF
out_gif_path = os.path.join("assets", "vyntric-avatar.gif")
os.makedirs(os.path.dirname(out_gif_path), exist_ok=True)

# Generate high quality 128-color adaptive palette
quantized_frames = []
palette_img = frames[0].quantize(colors=64)
for f in frames:
    q = f.quantize(palette=palette_img, dither=Image.Dither.FLOYDSTEINBERG)
    quantized_frames.append(q)

quantized_frames[0].save(
    out_gif_path,
    save_all=True,
    append_images=quantized_frames[1:],
    duration=int(1000 / FPS),
    loop=0,
    optimize=True
)

size_kb = os.path.getsize(out_gif_path) / 1024
print(f"Successfully generated {out_gif_path} ({size_kb:.1f} KB, {FRAMES} frames @ {FPS} fps)")
