import math
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 900, 300
img = Image.new("RGBA", (W, H), (8, 2, 4, 255))
draw = ImageDraw.Draw(img)

# Radial gradient background
center_x, center_y = W // 2, H // 2 - 10

bg_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
bg_draw = ImageDraw.Draw(bg_layer)

for r in range(320, 0, -8):
    alpha = int(45 * (1 - r / 320))
    bg_draw.ellipse(
        [center_x - r * 1.5, center_y - r * 0.9, center_x + r * 1.5, center_y + r * 0.9],
        fill=(177, 18, 31, alpha),
    )

img = Image.alpha_composite(img, bg_layer)
draw = ImageDraw.Draw(img)

# Cyber grid overlay
grid_color = (177, 18, 31, 28)
grid_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
grid_draw = ImageDraw.Draw(grid_layer)

for x in range(0, W, 36):
    grid_draw.line([(x, 0), (x, H)], fill=grid_color, width=1)
for y in range(0, H, 36):
    grid_draw.line([(0, y), (W, y)], fill=grid_color, width=1)

# Subtle concentric radar rings
for r in [90, 160, 230]:
    grid_draw.ellipse(
        [center_x - r * 1.6, center_y - r * 0.7, center_x + r * 1.6, center_y + r * 0.7],
        outline=(177, 18, 31, 35),
        width=1,
    )

img = Image.alpha_composite(img, grid_layer)
draw = ImageDraw.Draw(img)

# Tech frame border
frame_color = (177, 18, 31, 220)
accent_red = (255, 34, 51, 255)

# Outer border lines
draw.line([(40, 25), (W - 40, 25)], fill=frame_color, width=2)
draw.line([(40, H - 25), (W - 40, H - 25)], fill=frame_color, width=2)
draw.line([(30, 35), (30, H - 35)], fill=frame_color, width=2)
draw.line([(W - 30, 35), (W - 30, H - 35)], fill=frame_color, width=2)

# Corner tech brackets
corner_len = 30
# Top-Left
draw.line([(30, 25), (30 + corner_len, 25)], fill=accent_red, width=3)
draw.line([(30, 25), (30, 25 + corner_len)], fill=accent_red, width=3)
# Top-Right
draw.line([(W - 30 - corner_len, 25), (W - 30, 25)], fill=accent_red, width=3)
draw.line([(W - 30, 25), (W - 30, 25 + corner_len)], fill=accent_red, width=3)
# Bottom-Left
draw.line([(30, H - 25), (30 + corner_len, H - 25)], fill=accent_red, width=3)
draw.line([(30, H - 25 - corner_len), (30, H - 25)], fill=accent_red, width=3)
# Bottom-Right
draw.line([(W - 30 - corner_len, H - 25), (W - 30, H - 25)], fill=accent_red, width=3)
draw.line([(W - 30, H - 25 - corner_len), (W - 30, H - 25)], fill=accent_red, width=3)

# Little corner dots
for cx, cy in [(42, 35), (W - 42, 35), (42, H - 35), (W - 42, H - 35)]:
    draw.rectangle([cx - 2, cy - 2, cx + 2, cy + 2], fill=accent_red)

# Draw Security Shield with V-crest inside
shield_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
s_draw = ImageDraw.Draw(shield_layer)

shield_cx = center_x
shield_cy = 72
sw, sh = 36, 46

shield_pts = [
    (shield_cx - sw, shield_cy - sh // 2),
    (shield_cx, shield_cy - sh // 2 + 6),
    (shield_cx + sw, shield_cy - sh // 2),
    (shield_cx + sw, shield_cy + 4),
    (shield_cx, shield_cy + sh // 2 + 12),
    (shield_cx - sw, shield_cy + 4),
]
s_draw.polygon(shield_pts, fill=(40, 5, 10, 230), outline=(255, 34, 51, 230), width=2)

# V-crest inside shield
v_pts = [
    (shield_cx - 20, shield_cy - 12),
    (shield_cx - 10, shield_cy - 12),
    (shield_cx, shield_cy + 12),
    (shield_cx + 10, shield_cy - 12),
    (shield_cx + 20, shield_cy - 12),
    (shield_cx + 4, shield_cy + 18),
    (shield_cx - 4, shield_cy + 18),
]
s_draw.polygon(v_pts, fill=(255, 255, 255, 250))

shield_blur = shield_layer.filter(ImageFilter.GaussianBlur(3))
img = Image.alpha_composite(img, shield_blur)
img = Image.alpha_composite(img, shield_layer)
draw = ImageDraw.Draw(img)

# Fonts
font_title = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 54)
font_sub = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 15)
font_tag = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 14)

# Subtitle at top: "V Y N T R I C   S E C U R I T Y"
tag_text = "V Y N T R I C   S E C U R I T Y"
tag_bbox = draw.textbbox((0, 0), tag_text, font=font_tag)
tag_w = tag_bbox[2] - tag_bbox[0]
tag_x = center_x - tag_w // 2
tag_y = 120
draw.text((tag_x, tag_y), tag_text, font=font_tag, fill=(255, 100, 110, 240))

# Vector diamonds flanking "V Y N T R I C   S E C U R I T Y"
d_rad = 4
for dx in [tag_x - 18, tag_x + tag_w + 18]:
    dy = tag_y + 8
    draw.polygon([(dx, dy - d_rad), (dx + d_rad, dy), (dx, dy + d_rad), (dx - d_rad, dy)], fill=accent_red)

# Main Title: "VERIFY NOW"
title_text = "VERIFY NOW"
title_bbox = draw.textbbox((0, 0), title_text, font=font_title)
title_w = title_bbox[2] - title_bbox[0]
title_h = title_bbox[3] - title_bbox[1]
title_x = center_x - title_w // 2
title_y = 146

# Neon glow behind title
glow_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
g_draw = ImageDraw.Draw(glow_layer)
g_draw.text((title_x, title_y), title_text, font=font_title, fill=(255, 25, 45, 255))
glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(10))
img = Image.alpha_composite(img, glow_layer)
draw = ImageDraw.Draw(img)

# Text on top in pure white
draw.text((title_x, title_y), title_text, font=font_title, fill=(255, 255, 255, 255))

# Decorative line under title with diamond center
line_y = 222
line_half = 180
draw.line([(center_x - line_half, line_y), (center_x - 14, line_y)], fill=(177, 18, 31, 200), width=2)
draw.line([(center_x + 14, line_y), (center_x + line_half, line_y)], fill=(177, 18, 31, 200), width=2)

# Vector diamond in center of line
d_size = 6
draw.polygon(
    [
        (center_x, line_y - d_size),
        (center_x + d_size, line_y),
        (center_x, line_y + d_size),
        (center_x - d_size, line_y),
    ],
    fill=accent_red,
)

# Footer call to action: "CLICK THE VERIFY BUTTON BELOW TO UNLOCK FULL ACCESS"
call_text = "CLICK THE VERIFY BUTTON BELOW TO UNLOCK FULL ACCESS"
call_bbox = draw.textbbox((0, 0), call_text, font=font_sub)
call_w = call_bbox[2] - call_bbox[0]
draw.text((center_x - call_w // 2, 238), call_text, font=font_sub, fill=(225, 210, 215, 240))

os.makedirs("assets/banners", exist_ok=True)
out_path = os.path.abspath("assets/banners/vyntric-verify.png")
img.save(out_path, format="PNG", optimize=True)
print(f"Generated clean verify banner: {out_path} ({os.path.getsize(out_path)} bytes)")
