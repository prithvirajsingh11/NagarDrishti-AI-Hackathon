"""
Generate test image validation pack for NagarDrishti AI.
Creates sample civic test patterns and unclear/dark/blank failure cases.
"""
from pathlib import Path
from PIL import Image, ImageDraw

output_dir = Path(__file__).parent / "validation_pack"
output_dir.mkdir(parents=True, exist_ok=True)

# 1. Pothole sample image (gray road with dark depression)
def make_pothole():
    img = Image.new("RGB", (300, 300), color=(110, 115, 120))
    draw = ImageDraw.Draw(img)
    # Road surface cavity
    draw.ellipse([80, 100, 220, 210], fill=(45, 45, 50), outline=(30, 30, 35), width=3)
    # Asphalt fracture lines
    draw.line([60, 130, 95, 150], fill=(30, 30, 30), width=2)
    draw.line([210, 170, 250, 190], fill=(30, 30, 30), width=2)
    img.save(output_dir / "pothole_sample.jpg", format="JPEG")

# 2. Garbage pile sample image (pavement with mixed debris)
def make_garbage():
    img = Image.new("RGB", (300, 300), color=(140, 135, 130))
    draw = ImageDraw.Draw(img)
    # Scattered waste piles
    draw.polygon([(70, 180), (120, 120), (190, 140), (230, 200), (60, 210)], fill=(70, 90, 60))
    draw.rectangle([100, 150, 130, 180], fill=(200, 50, 50))
    draw.rectangle([150, 130, 175, 160], fill=(220, 200, 40))
    draw.ellipse([180, 170, 210, 195], fill=(40, 120, 200))
    img.save(output_dir / "garbage_sample.jpg", format="JPEG")

# 3. Streetlight sample image (sky background with damaged lamp pole)
def make_streetlight():
    img = Image.new("RGB", (300, 300), color=(135, 180, 220))
    draw = ImageDraw.Draw(img)
    # Pole
    draw.line([150, 50, 160, 300], fill=(80, 85, 90), width=8)
    # Broken fixture tilted
    draw.line([150, 60, 100, 40], fill=(60, 65, 70), width=6)
    draw.ellipse([90, 35, 115, 60], fill=(240, 230, 150), outline=(70, 70, 70), width=2)
    img.save(output_dir / "streetlight_sample.jpg", format="JPEG")

# 4. Drain sample image (street gutter channel)
def make_drain():
    img = Image.new("RGB", (300, 300), color=(100, 105, 110))
    draw = ImageDraw.Draw(img)
    # Drain opening
    draw.rectangle([70, 120, 230, 220], fill=(30, 35, 40))
    # Grate iron bars
    for x in range(85, 220, 25):
        draw.line([x, 120, x, 220], fill=(160, 165, 170), width=4)
    # Overflow liquid
    draw.polygon([(60, 220), (120, 240), (220, 235), (240, 260), (50, 260)], fill=(40, 70, 80))
    img.save(output_dir / "drain_sample.jpg", format="JPEG")

# 5. Unclear: Extremely dark image (< 15 average luminance)
def make_unclear_dark():
    img = Image.new("RGB", (300, 300), color=(5, 5, 6))
    img.save(output_dir / "unclear_dark.jpg", format="JPEG")

# 6. Unclear: Blank / Uniform image (< 4 standard deviation)
def make_unclear_blank():
    img = Image.new("RGB", (300, 300), color=(200, 200, 200))
    img.save(output_dir / "unclear_blank.jpg", format="JPEG")

# 7. Unclear: Non-civic indoor image
def make_unclear_indoor():
    img = Image.new("RGB", (300, 300), color=(230, 215, 195))
    draw = ImageDraw.Draw(img)
    # Draw a table with a laptop / coffee cup
    draw.rectangle([50, 180, 250, 240], fill=(139, 69, 19))
    draw.rectangle([110, 130, 190, 180], fill=(192, 192, 192))
    img.save(output_dir / "unclear_indoor.jpg", format="JPEG")

if __name__ == "__main__":
    make_pothole()
    make_garbage()
    make_streetlight()
    make_drain()
    make_unclear_dark()
    make_unclear_blank()
    make_unclear_indoor()
    print("Validation pack generated in:", output_dir)
