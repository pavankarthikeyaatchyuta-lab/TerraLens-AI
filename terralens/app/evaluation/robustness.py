"""Robustness evaluation suite: tests stress scenarios and false-alarm handling."""

from typing import Dict, Any, List
import numpy as np
from PIL import Image

from terralens.app.services.change_detector import DeterministicBiTemporalChangeDetector
from terralens.app.evaluation.change_metrics import compute_confusion_matrix


class RobustnessSuite:
    """Evaluates detector behavior across 7 controlled stress and perturbation scenarios."""

    def __init__(self, detector: DeterministicBiTemporalChangeDetector):
        self.detector = detector

    def run_all(self) -> Dict[str, Any]:
        """Runs the complete 7-scenario robustness suite and returns structured results."""
        results: Dict[str, Any] = {
            "scenario_1_no_change": self.test_no_change(),
            "scenario_2_known_change": self.test_known_change(),
            "scenario_3_low_quality": self.test_low_quality(),
            "scenario_4_illumination_variation": self.test_illumination_variation(),
            "scenario_5_seasonal_variation": self.test_seasonal_variation(),
            "scenario_6_spatial_misalignment": self.test_spatial_misalignment(),
            "scenario_7_cross_sensor": self.test_cross_sensor(),
        }

        all_passed = all(r.get("passed", False) for r in results.values())
        return {
            "all_passed": all_passed,
            "total_scenarios": len(results),
            "passed_scenarios": sum(1 for r in results.values() if r.get("passed", False)),
            "scenarios": results,
        }

    def test_no_change(self) -> Dict[str, Any]:
        """Scenario 1: Identical scene pair (invariant scene)."""
        img = Image.new("RGB", (100, 100), color=(80, 120, 80))
        res = self.detector.detect(img, img, location_id="ROB_NO_CHANGE")
        passed = (res.status == "NO_SIGNIFICANT_CHANGE") and (res.changed_pixels == 0)
        return {
            "scenario": "No-change invariant pair",
            "passed": passed,
            "status": res.status,
            "changed_pixels": res.changed_pixels,
            "confidence_score": res.confidence_score,
            "notes": "Verified that zero change occurs on identical inputs.",
        }

    def test_known_change(self) -> Dict[str, Any]:
        """Scenario 2: Known synthetic 40x40 structural change block."""
        y, x = np.mgrid[0:120, 0:120]
        base = (50 + 0.3 * x + 0.3 * y).astype(np.uint8)
        b = np.stack([base, base, base], axis=-1)
        a = b.copy()
        a[20:60, 20:60, :] = 230

        gt = np.zeros((120, 120), dtype=np.uint8)
        gt[20:60, 20:60] = 255

        res = self.detector.detect(
            Image.fromarray(b),
            Image.fromarray(a),
            location_id="ROB_KNOWN_CHANGE",
            difference_threshold=30,
            min_region_size_pixels=25,
        )

        passed = (res.status == "CHANGE_DETECTED") and (res.changed_pixels >= 1400) and (len(res.change_regions) >= 1)
        return {
            "scenario": "Known synthetic change block",
            "passed": passed,
            "status": res.status,
            "changed_pixels": res.changed_pixels,
            "regions_count": len(res.change_regions),
            "confidence_score": res.confidence_score,
            "notes": "Verified detection of continuous change block with region clustering.",
        }

    def test_low_quality(self) -> Dict[str, Any]:
        """Scenario 3: Low-contrast image pair with narrow dynamic range."""
        arr_low = np.full((100, 100, 3), 128, dtype=np.uint8)
        res = self.detector.detect(Image.fromarray(arr_low), Image.fromarray(arr_low), location_id="ROB_LOW_QUALITY")

        has_warning = any("Low contrast" in w for w in res.warnings)
        passed = has_warning and (res.quality_score is not None and res.quality_score < 0.20)
        return {
            "scenario": "Low-quality / narrow dynamic range",
            "passed": passed,
            "warnings_generated": res.warnings,
            "quality_score": res.quality_score,
            "notes": "Verified that detector triggers low-contrast warning and avoids blind trust.",
        }

    def test_illumination_variation(self) -> Dict[str, Any]:
        """Scenario 4: Significant global illumination offset (+45) on identical content."""
        y, x = np.mgrid[0:100, 0:100]
        base = (60 + 0.4 * x + 0.4 * y).astype(np.uint8)
        b = np.stack([base, base, base], axis=-1)
        # Shift after image by +40 brightness uniformly
        a = np.clip(b.astype(np.int32) + 40, 0, 255).astype(np.uint8)

        res = self.detector.detect(
            Image.fromarray(b),
            Image.fromarray(a),
            location_id="ROB_ILLUM",
            difference_threshold=30,
            min_region_size_pixels=25,
        )

        # Radiometric illumination matching should absorb the uniform gain/offset
        passed = (res.status == "NO_SIGNIFICANT_CHANGE") and (res.changed_pixels == 0)
        return {
            "scenario": "Global illumination variation (+40 offset)",
            "passed": passed,
            "status": res.status,
            "changed_pixels": res.changed_pixels,
            "preprocessing_steps": res.preprocessing_steps,
            "notes": "Verified that mean/std illumination normalization prevents false alarms from sun angle.",
        }

    def test_seasonal_variation(self) -> Dict[str, Any]:
        """Scenario 5: Subtle diffuse phenology variation across vegetation."""
        y, x = np.mgrid[0:100, 0:100]
        base = (70 + 0.3 * x + 0.3 * y).astype(np.uint8)
        b = np.stack([base, base + 20, base], axis=-1)  # greener
        a = np.stack([base, base + 10, base], axis=-1)  # slightly less green (dry season)

        res = self.detector.detect(
            Image.fromarray(b),
            Image.fromarray(a),
            location_id="ROB_SEASONAL",
            difference_threshold=30,
            min_region_size_pixels=25,
        )

        passed = (res.status == "NO_SIGNIFICANT_CHANGE")
        return {
            "scenario": "Seasonal phenology variation",
            "passed": passed,
            "status": res.status,
            "changed_pixels": res.changed_pixels,
            "notes": "Verified that thresholding + illumination matching suppresses diffuse seasonal foliage shifts.",
        }

    def test_spatial_misalignment(self) -> Dict[str, Any]:
        """Scenario 6: Spatial shape dimension mismatch (100x100 vs 140x140)."""
        img1 = Image.new("RGB", (100, 100), color=(100, 100, 100))
        img2 = Image.new("RGB", (140, 140), color=(100, 100, 100))

        res = self.detector.detect(img1, img2, location_id="ROB_MISALIGN")
        has_align_step = any("Spatial alignment" in s for s in res.preprocessing_steps)
        passed = has_align_step and (res.total_pixels == 10000)

        return {
            "scenario": "Spatial dimension mismatch normalization",
            "passed": passed,
            "total_pixels_evaluated": res.total_pixels,
            "preprocessing_steps": res.preprocessing_steps,
            "notes": "Verified that ImageAlignmentService reconciles dimensions without crashing.",
        }

    def test_cross_sensor(self) -> Dict[str, Any]:
        """Scenario 7: Cross-sensor comparison (Sentinel-2 MSI vs PlanetScope Dove)."""
        img = Image.new("RGB", (80, 80), color=(90, 110, 90))
        res = self.detector.detect(
            img,
            img,
            location_id="ROB_CROSS_SENSOR",
            before_sensor="Sentinel-2 MSI",
            after_sensor="PlanetScope Dove",
        )

        has_cross_warning = any("Cross-sensor comparison" in w for w in res.warnings)
        has_penalty = res.confidence_breakdown.get("sensor_mismatch_penalty", 0.0) > 0.0
        passed = has_cross_warning and has_penalty

        return {
            "scenario": "Cross-sensor comparison",
            "passed": passed,
            "warnings": res.warnings,
            "sensor_mismatch_penalty": res.confidence_breakdown.get("sensor_mismatch_penalty", 0.0),
            "notes": "Verified that sensor mismatch triggers explicit warnings and score penalty.",
        }
