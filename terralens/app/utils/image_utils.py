"""Image utility functions for safe loading, thumbnailing, and diagnostics."""

import logging
from pathlib import Path
from typing import Optional, Tuple
from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger("terralens.image_utils")


def load_image_safely(image_path: str | Path) -> Optional[Image.Image]:
    """Loads an image safely from disk, returning None and logging if missing or corrupt."""
    if not image_path:
        return None

    path = Path(image_path)
    if not path.exists():
        logger.warning(f"Image not found at path: {path}")
        return None

    try:
        img = Image.open(path)
        img.load()  # Force reading bytes to verify integrity
        return img
    except Exception as e:
        logger.error(f"Failed to load or parse image at {path}: {e}")
        return None


def get_image_dimensions(image_path: str | Path) -> Optional[Tuple[int, int]]:
    """Returns (width, height) of an image or None if unreadable."""
    img = load_image_safely(image_path)
    if img:
        return img.size
    return None


def create_placeholder_image(
    text: str = "Image Unavailable",
    size: Tuple[int, int] = (512, 512),
    bg_color: Tuple[int, int, int] = (25, 30, 40),
    text_color: Tuple[int, int, int] = (180, 190, 205)
) -> Image.Image:
    """Generates an informative placeholder image when imagery is missing."""
    img = Image.new("RGB", size, color=bg_color)
    draw = ImageDraw.Draw(img)

    # Simple cross grid for geospatial aesthetic
    w, h = size
    grid_color = (40, 48, 65)
    for x in range(0, w, 64):
        draw.line([(x, 0), (x, h)], fill=grid_color, width=1)
    for y in range(0, h, 64):
        draw.line([(0, y), (w, y)], fill=grid_color, width=1)

    # Draw border
    draw.rectangle([(2, 2), (w - 3, h - 3)], outline=(70, 85, 110), width=2)

    # Draw warning label
    draw.text((w // 2, h // 2), text, fill=text_color, anchor="mm")
    return img


def generate_thumbnail(image_path: str | Path, max_size: Tuple[int, int] = (256, 256)) -> Optional[Image.Image]:
    """Loads an image and creates a proportional thumbnail."""
    img = load_image_safely(image_path)
    if img is None:
        return create_placeholder_image(text="No Thumbnail", size=max_size)

    img.thumbnail(max_size, Image.Resampling.LANCZOS)
    return img
