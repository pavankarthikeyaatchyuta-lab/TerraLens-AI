"""Image viewer component for rendering satellite imagery and thumbnails."""

from pathlib import Path
from typing import Optional
import streamlit as st
from PIL import Image

from terralens.app.utils.image_utils import load_image_safely, create_placeholder_image


def display_satellite_image(
    image_path: Optional[str | Path],
    caption: str = "",
    use_container_width: bool = True
) -> None:
    """Renders a satellite image or a graceful placeholder if the file is missing."""
    if not image_path:
        placeholder = create_placeholder_image(text="No Scene Staged")
        st.image(placeholder, caption=caption or "No Scene Available", use_container_width=use_container_width)
        return

    img = load_image_safely(image_path)
    if img is not None:
        st.image(img, caption=caption, use_container_width=use_container_width)
    else:
        placeholder = create_placeholder_image(text="Image File Not Found")
        st.image(placeholder, caption=f"{caption} (Error: Corrupt or Missing File)", use_container_width=use_container_width)
