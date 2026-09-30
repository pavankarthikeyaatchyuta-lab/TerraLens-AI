"""Deterministic multi-temporal change detection engine and false-alarm mitigation pipeline."""

from abc import ABC, abstractmethod
import json
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple, Union
import numpy as np
from PIL import Image
import cv2

from terralens.app.models.change import ChangeRegion, ChangeDetectionResult
from terralens.app.services.alignment_service import ImageAlignmentService
from terralens.app.utils.config import config

logger = logging.getLogger("terralens.change_detector")


class BaseChangeDetector(ABC):
    """Abstract interface for multi-temporal satellite change detectors."""

    def __init__(self, detector_name: str, detector_label: str):
        self.detector_name = detector_name
        self.detector_label = detector_label

    @abstractmethod
    def detect(
        self,
        before_image: Union[Image.Image, np.ndarray],
        after_image: Union[Image.Image, np.ndarray],
        location_id: str = "LOC_GENERIC",
        before_date: str = "T1",
        after_date: str = "T2",
        before_sensor: str = "Sentinel-2 MSI",
        after_sensor: str = "Sentinel-2 MSI",
        **kwargs
    ) -> ChangeDetectionResult:
        """Executes multi-temporal comparison between baseline and monitoring scene."""
        pass


class DeterministicBiTemporalChangeDetector(BaseChangeDetector):
    """Deterministic pixel-difference and false-alarm mitigated change detection engine.

    Pipeline:
    1. Validation & Quality Assessment
    2. Spatial Alignment & Coordinate Space Reconciliation
    3. Radiometric Normalization (Illumination & Contrast Alignment)
    4. Absolute Difference Magnitude Calculation
    5. Adaptive/Configurable Thresholding
    6. Morphological Noise Reduction & Spatial Filtering
    7. Connected Component Analysis & Structured Region Extraction
    8. Measurable Confidence Estimation based on Signal-to-Noise & Spatial Coherence
    9. Artifact Persistence (Binary Change Mask, Difference Heatmap, Overlay)
    """

    def __init__(
        self,
        change_threshold: float = 28.0,
        min_change_area: int = 120,
        morph_kernel_size: int = 3,
        blur_kernel_size: int = 3,
        illumination_match: bool = True,
        output_dir: Optional[Path] = None,
    ):
        super().__init__(
            detector_name="DeterministicBiTemporalChangeDetector",
            detector_label="Deterministic Bi-Temporal Baseline",
        )
        self.change_threshold = change_threshold
        self.min_change_area = min_change_area
        self.morph_kernel_size = morph_kernel_size
        self.blur_kernel_size = blur_kernel_size
        self.illumination_match = illumination_match
        self.output_dir = Path(output_dir or (config.DATA_DIR / "outputs" / "change_masks"))
        self.alignment_service = ImageAlignmentService()

    @staticmethod
    def _assess_quality(b_arr: np.ndarray, a_arr: np.ndarray) -> Tuple[float, List[str]]:
        """Computes measurable contrast, dynamic range, and flags potential image degradation."""
        warnings: List[str] = []
        b_gray = cv2.cvtColor(b_arr, cv2.COLOR_RGB2GRAY) if b_arr.ndim == 3 else b_arr
        a_gray = cv2.cvtColor(a_arr, cv2.COLOR_RGB2GRAY) if a_arr.ndim == 3 else a_arr

        b_std = float(np.std(b_gray))
        a_std = float(np.std(a_gray))

        # Contrast warning
        if b_std < 10.0 or a_std < 10.0:
            warnings.append("Low contrast warning: One or both scenes exhibit narrow radiometric dynamic range.")

        # Extreme saturation / darkness
        if np.mean(b_gray) < 15 or np.mean(a_gray) < 15:
            warnings.append("Severe underexposure / shadow warning: Large regions are near black.")
        if np.mean(b_gray) > 240 or np.mean(a_gray) > 240:
            warnings.append("Severe overexposure / haze warning: Large regions are near white saturation.")

        # Quality score bounded in [0.0, 1.0]
        quality_score = min(1.0, max(0.0, (min(b_std, a_std) / 50.0)))
        return round(quality_score, 3), warnings

    def detect(
        self,
        before_image: Union[Image.Image, np.ndarray],
        after_image: Union[Image.Image, np.ndarray],
        location_id: str = "LOC_GENERIC",
        before_date: str = "T1",
        after_date: str = "T2",
        before_sensor: str = "Sentinel-2 MSI",
        after_sensor: str = "Sentinel-2 MSI",
        change_threshold: Optional[float] = None,
        min_change_area: Optional[int] = None,
        **kwargs
    ) -> ChangeDetectionResult:
        """Executes multi-temporal comparison between baseline and monitoring scene."""
        thresh = change_threshold if change_threshold is not None else kwargs.get("difference_threshold", self.change_threshold)
        min_area = min_change_area if min_change_area is not None else kwargs.get("min_region_size_pixels", self.min_change_area)
        preprocessing_steps: List[str] = []
        warnings: List[str] = []

        # 1. Validation
        if before_image is None or after_image is None:
            return ChangeDetectionResult(
                status="INCOMPLETE_DATA",
                change_type="None",
                warnings=["Missing one or both temporal imagery scenes."],
                diagnostics={"error": "One of the input images is None"},
            )

        b_rgb = self.alignment_service.to_numpy_rgb(before_image)
        a_rgb = self.alignment_service.to_numpy_rgb(after_image)

        if b_rgb.size == 0 or a_rgb.size == 0:
            return ChangeDetectionResult(
                status="INCOMPLETE_DATA",
                change_type="None",
                warnings=["Decoded image buffer is empty."],
                diagnostics={"error": "Empty image array"},
            )

        preprocessing_steps.append("Image validation: 3-channel RGB uint8 arrays confirmed")

        # Sensor difference check
        sensor_mismatch = before_sensor.strip().lower() != after_sensor.strip().lower()
        if sensor_mismatch:
            warnings.append(
                f"Cross-sensor comparison ({before_sensor} vs {after_sensor}): "
                "Different spectral band passes and radiometric responses may elevate false alarms."
            )

        # 2. Quality assessment
        quality_score, quality_warnings = self._assess_quality(b_rgb, a_rgb)
        warnings.extend(quality_warnings)
        preprocessing_steps.append(f"Image quality assessment: Quality score {quality_score:.3f}")

        # 3. Spatial alignment
        b_aligned, a_aligned, align_op, align_meta = self.alignment_service.align(b_rgb, a_rgb)
        preprocessing_steps.append(f"Spatial alignment: {align_op}")

        h, w = b_aligned.shape[:2]
        total_pixels = h * w

        # 4. Radiometric normalization (Illumination & Contrast Alignment)
        b_gray = cv2.cvtColor(b_aligned, cv2.COLOR_RGB2GRAY).astype(np.float32)
        a_gray = cv2.cvtColor(a_aligned, cv2.COLOR_RGB2GRAY).astype(np.float32)

        if self.blur_kernel_size > 1:
            k = self.blur_kernel_size if self.blur_kernel_size % 2 == 1 else self.blur_kernel_size + 1
            b_gray = cv2.GaussianBlur(b_gray, (k, k), 0)
            a_gray = cv2.GaussianBlur(a_gray, (k, k), 0)
            preprocessing_steps.append(f"Gaussian filtering: Kernel size ({k}x{k}) applied for high-frequency noise rejection")

        if self.illumination_match:
            b_mean, b_std = float(np.mean(b_gray)), float(np.std(b_gray))
            a_mean, a_std = float(np.mean(a_gray)), float(np.std(a_gray))
            if a_std > 2.0 and b_std > 2.0:
                # Full gain and offset matching
                a_norm = b_mean + (a_gray - a_mean) * (b_std / a_std)
                a_gray = np.clip(a_norm, 0, 255).astype(np.float32)
                preprocessing_steps.append(f"Radiometric normalization: Contrast & mean illumination matched (mu={b_mean:.1f}, sigma={b_std:.1f})")
            elif abs(a_mean - b_mean) > 1.0:
                # Mean offset matching
                offset = b_mean - a_mean
                a_gray = np.clip(a_gray + offset, 0, 255).astype(np.float32)
                preprocessing_steps.append(f"Radiometric normalization: Mean illumination offset adjusted ({offset:+.1f})")

        # 5. Absolute pixel difference & thresholding
        diff = np.abs(a_gray - b_gray)
        raw_mask = (diff >= thresh).astype(np.uint8) * 255
        raw_changed_pixels = int(np.count_nonzero(raw_mask))
        preprocessing_steps.append(f"Difference calculation: Absolute intensity delta with threshold={thresh:.1f}")

        # 6. False-Alarm Mitigation & Morphological Cleanup
        k_morph = self.morph_kernel_size if self.morph_kernel_size % 2 == 1 else self.morph_kernel_size + 1
        morph_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k_morph, k_morph))

        # Opening removes isolated single-pixel speckle noise
        opened_mask = cv2.morphologyEx(raw_mask, cv2.MORPH_OPEN, morph_kernel)
        # Closing bridges contiguous infrastructure elements
        closed_mask = cv2.morphologyEx(opened_mask, cv2.MORPH_CLOSE, morph_kernel)
        preprocessing_steps.append(f"Morphological filtering: Opening + Closing with ({k_morph}x{k_morph}) kernel")

        # 7. Connected component analysis & region filtering
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(closed_mask, connectivity=8)

        final_mask = np.zeros_like(closed_mask, dtype=np.uint8)
        change_regions: List[ChangeRegion] = []
        region_counter = 1

        for i in range(1, num_labels):  # Skip label 0 (background)
            area = int(stats[i, cv2.CC_STAT_AREA])
            if area >= min_area:
                final_mask[labels == i] = 255
                x = int(stats[i, cv2.CC_STAT_LEFT])
                y = int(stats[i, cv2.CC_STAT_TOP])
                width = int(stats[i, cv2.CC_STAT_WIDTH])
                height = int(stats[i, cv2.CC_STAT_HEIGHT])
                cx = float(centroids[i][0])
                cy = float(centroids[i][1])
                rel_area = area / float(total_pixels)

                change_regions.append(
                    ChangeRegion(
                        region_id=region_counter,
                        x=x,
                        y=y,
                        width=width,
                        height=height,
                        area_pixels=area,
                        relative_area=round(rel_area, 5),
                        centroid=(round(cx, 2), round(cy, 2)),
                    )
                )
                region_counter += 1

        # Sort regions largest to smallest
        change_regions.sort(key=lambda r: r.area_pixels, reverse=True)

        changed_pixels = int(np.count_nonzero(final_mask))
        change_ratio = changed_pixels / float(total_pixels) if total_pixels > 0 else 0.0
        preprocessing_steps.append(
            f"Connected component extraction: {len(change_regions)} contiguous regions retained (min_area={min_area}px)"
        )

        # 8. Status & Classification
        if change_ratio < 0.002:  # Less than 0.2% changed
            status = "NO_SIGNIFICANT_CHANGE"
            change_type = "No Significant Change"
        elif quality_score < 0.2 or len(warnings) >= 3:
            status = "UNCERTAIN"
            change_type = "Uncertain"
        else:
            status = "CHANGE_DETECTED"
            change_type = "Detected Change"

        # 9. Measurable Confidence Calculation
        mismatch_penalty = 0.15 if sensor_mismatch else 0.0
        quality_penalty = 0.10 if any("Low contrast" in w for w in warnings) else 0.0
        total_penalty = min(0.30, mismatch_penalty + quality_penalty)

        if changed_pixels > 0:
            mean_diff_changed = float(np.mean(diff[final_mask == 255]))
            signal_strength = min(1.0, max(0.0, (mean_diff_changed - thresh) / 60.0))
            spatial_coherence = min(1.0, max(0.0, changed_pixels / max(1.0, float(raw_changed_pixels))))

            raw_confidence = (0.45 * signal_strength) + (0.35 * spatial_coherence) + (0.20 * quality_score) - total_penalty
            confidence_score = round(float(np.clip(raw_confidence, 0.05, 0.98)), 3)
            confidence_breakdown = {
                "signal_strength": round(signal_strength, 3),
                "spatial_coherence": round(spatial_coherence, 3),
                "quality_score": round(quality_score, 3),
                "penalty": round(total_penalty, 3),
                "sensor_mismatch_penalty": round(mismatch_penalty, 3),
            }
        else:
            confidence_score = 0.95 if quality_score > 0.4 else round(max(0.10, quality_score), 3)
            confidence_breakdown = {
                "signal_strength": 0.0,
                "spatial_coherence": 1.0,
                "quality_score": round(quality_score, 3),
                "penalty": round(total_penalty, 3),
                "sensor_mismatch_penalty": round(mismatch_penalty, 3),
            }

        # 10. Visual Artifact Generation & Persistence
        mask_path, diff_path, overlay_path = self._persist_artifacts(
            location_id=location_id,
            before_date=before_date,
            after_date=after_date,
            diff_matrix=diff,
            final_mask=final_mask,
            after_rgb=a_aligned,
            change_regions=change_regions,
        )

        return ChangeDetectionResult(
            status=status,
            change_type=change_type,
            detector_name=self.detector_name,
            detector_label=self.detector_label,
            changed_pixels=changed_pixels,
            total_pixels=total_pixels,
            change_ratio=round(change_ratio, 5),
            change_regions=change_regions,
            confidence_score=confidence_score,
            confidence_breakdown=confidence_breakdown,
            quality_score=quality_score,
            change_mask_path=mask_path,
            difference_image_path=diff_path,
            overlay_image_path=overlay_path,
            preprocessing_steps=preprocessing_steps,
            warnings=warnings,
            diagnostics={
                "threshold": thresh,
                "min_area": min_area,
                "raw_changed_pixels": raw_changed_pixels,
                "morph_kernel_size": k_morph,
                "illumination_matched": self.illumination_match,
                "shape": (w, h),
            },
        )

    def _persist_artifacts(
        self,
        location_id: str,
        before_date: str,
        after_date: str,
        diff_matrix: np.ndarray,
        final_mask: np.ndarray,
        after_rgb: np.ndarray,
        change_regions: List[ChangeRegion],
    ) -> Tuple[str, str, str]:
        """Saves binary mask, difference heatmap, and bounding overlay to disk."""
        self.output_dir.mkdir(parents=True, exist_ok=True)
        base_name = f"{location_id}_{before_date[:4]}_{after_date[:4]}"

        # 1. Binary Change Mask PNG
        mask_filename = f"{base_name}_change_mask.png"
        mask_path = self.output_dir / mask_filename
        cv2.imwrite(str(mask_path), final_mask)

        # 2. Difference Heatmap PNG
        norm_diff = cv2.normalize(diff_matrix, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
        heatmap = cv2.applyColorMap(norm_diff, cv2.COLORMAP_JET)
        heatmap_filename = f"{base_name}_diff_heatmap.png"
        diff_path = self.output_dir / heatmap_filename
        cv2.imwrite(str(diff_path), heatmap)

        # 3. Highlight Overlay with Bounding Boxes PNG
        overlay = after_rgb.copy()
        # Red tint over changed pixels: (B=40, G=40, R=240)
        red_tint = np.zeros_like(after_rgb)
        red_tint[:, :] = [240, 45, 60]
        mask_bool = final_mask == 255
        overlay[mask_bool] = (overlay[mask_bool] * 0.45 + red_tint[mask_bool] * 0.55).astype(np.uint8)

        # Draw green bounding boxes for top regions
        for reg in change_regions[:10]:
            cv2.rectangle(
                overlay,
                (reg.x, reg.y),
                (reg.x + reg.width, reg.y + reg.height),
                (74, 222, 128),  # Green box
                2
            )

        overlay_filename = f"{base_name}_overlay.png"
        overlay_path = self.output_dir / overlay_filename
        # Convert RGB to BGR for cv2.imwrite
        cv2.imwrite(str(overlay_path), cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR))

        # 4. Manifest JSON
        manifest_path = self.output_dir / f"{base_name}_manifest.json"
        manifest_data = {
            "location_id": location_id,
            "before_date": before_date,
            "after_date": after_date,
            "mask_file": str(mask_path),
            "diff_file": str(diff_path),
            "overlay_file": str(overlay_path),
            "total_regions": len(change_regions),
        }
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest_data, f, indent=2)

        return str(mask_path), str(diff_path), str(overlay_path)
