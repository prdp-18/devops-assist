#!/usr/bin/env python3
"""
Generate PWA icons for DevOps Companion App
Creates various icon sizes required for PWA manifest
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, filename):
    """Create an icon with the specified size"""
    # Create a new image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Define colors
    bg_color = (37, 99, 235)  # Blue
    text_color = (255, 255, 255)  # White
    
    # Draw background circle
    margin = size // 10
    draw.ellipse([margin, margin, size - margin, size - margin], fill=bg_color)
    
    # Add text (simplified - just "DC" for DevOps Companion)
    try:
        # Try to use a system font
        font_size = size // 3
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except:
        # Fallback to default font
        font = ImageFont.load_default()
    
    # Calculate text position
    text = "DC"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    x = (size - text_width) // 2
    y = (size - text_height) // 2
    
    # Draw text
    draw.text((x, y), text, fill=text_color, font=font)
    
    # Save the image
    img.save(filename, 'PNG')
    print(f"Created {filename} ({size}x{size})")

def main():
    """Generate all required PWA icons"""
    # Ensure icons directory exists
    os.makedirs('icons', exist_ok=True)
    
    # Icon sizes required by PWA manifest
    icon_sizes = [16, 32, 72, 96, 128, 144, 152, 192, 384, 512]
    
    for size in icon_sizes:
        filename = f'icons/icon-{size}x{size}.png'
        create_icon(size, filename)
    
    print("\nAll PWA icons generated successfully!")
    print("Icons created:")
    for size in icon_sizes:
        print(f"  - icons/icon-{size}x{size}.png")

if __name__ == "__main__":
    main()
