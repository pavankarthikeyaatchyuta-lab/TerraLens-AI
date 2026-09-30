"""Image alignment and spatial normalization service for multi-temporal satellite scene pairs."""

import logging
from typing import Tuple, Dict, Any, Union
import numpy as np
from PIL import Image
import cv2

logger = logging.getLogger("terralens.alignment_service")


class ImageAlignmentService:
    """Handles spatial compatibility, alignment verification, and coordinate grid reconciliation."""

    def __init__(self):
        self.service_name = "ImageAlignmentService"

    @staticmethod
    def to_numpy_rgb(image: Union[Image.Image, np.ndarray]) -> np.ndarray:
        """Converts input image safely to uint8 RGB NumPy array."""
        if isinstance(image, Image.Image):
            rgb = image.convert("RGB")
            return np.array(rgb, dtype=np.uint8)
        arr = np.asarray(image)
        if arr.dtype != np.uint8:
            # Normalize to 0-255 uint8 if float
            if np.issubdtype(arr.dtype, np.floating):
                arr = np.clip(arr * 255.0 if arr.max() <= 1.0 else arr, 0, 255).astype(np.uint8)
            else:
                arr = np.clip(arr, 0, 255).astype(np.uint8)
        if arr.ndim == 2:
            return cv2.cvtColor(arr, cv2.COLOR_GRAY2RGB)
        if arr.ndim == 3 and arr.shape[2] == 4:
            return cv2.cvtColor(arr, cv2.COLOR_RGBA2RGB)
        return arr

    def check_alignment(
        self,
        before_img: Union[Image.Image, np.ndarray],
        after_img: Union[Image.Image, np.ndarray]
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """Verifies spatial shape compatibility and reports alignment status."""
        b_arr = self.to_numpy_rgb(before_img)
        a_arr = self.to_numpy_rgb(after_img)

        b_h, b_w = b_arr.shape[:2]
        a_h, a_w = a_arr.shape[:2]

        dims_match = (b_h == a_h) and (b_w == a_w)
        meta = {
            "before_shape": (b_w, b_h),
            "after_shape": (a_w, a_h),
            "exact_dimension_match": dims_match,
        }

        if dims_match:
            return True, f"Native spatial coordinates aligned: ({b_w}x{b_h})", meta
        return False, f"Spatial dimension mismatch: ({b_w}x{b_h}) vs ({a_w}x{a_h})", meta

    def align(
        self,
        before_img: Union[Image.Image, np.ndarray],
        after_img: Union[Image.Image, np.ndarray]
    ) -> Tuple[np.ndarray, np.ndarray, str, Dict[str, Any]]:
        """Reconciles spatial grids to a shared comparison space without claiming fake georeferencing."""
        b_arr = self.to_numpy_rgb(before_img)
        a_arr = self.to_numpy_rgb(after_img)

        is_aligned, msg, meta = self.check_alignment(b_arr, a_arr)

        if is_aligned:
            operation = "Identity alignment: Native coordinates aligned"
            return b_arr, a_arr, operation, meta

        # Reconcile dimensions by resizing monitoring scene to match baseline scene space
        target_w, target_h = meta["before_shape"]
        interpolation = cv2.INTER_AREA if (a_arr.shape[1] > target_w) else cv2.INTER_LINEAR
        a_resized = cv2.resize(a_arr, (target_w, target_h), interpolation=interpolation)

        operation = f"Image dimensions normalized: Resized monitoring scene from {meta['after_shape']} to ({target_w}x{target_h})"
        meta["normalized_shape"] = (target_w, target_h)
        meta["resampling_method"] = "INTER_AREA" if interpolation == cv2.INTER_AREA else "INTER_LINEAR"

        logger.info(operation)
        return b_arr, a_resized, operation, meta
