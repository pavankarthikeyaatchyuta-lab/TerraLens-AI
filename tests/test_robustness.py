"""Unit tests for the 7 robustness stress scenarios."""

from terralens.app.services.change_detector import DeterministicBiTemporalChangeDetector
from terralens.app.evaluation.robustness import RobustnessSuite


def test_robustness_suite_scenarios(tmp_path):
    """Tests that all 7 robustness conditions execute and pass their expected criteria."""
    detector = DeterministicBiTemporalChangeDetector(output_dir=tmp_path)
    suite = RobustnessSuite(detector)

    # 1. No change
    res1 = suite.test_no_change()
    assert res1["passed"] is True
    assert res1["status"] == "NO_SIGNIFICANT_CHANGE"
    assert res1["changed_pixels"] == 0

    # 2. Known change
    res2 = suite.test_known_change()
    assert res2["passed"] is True
    assert res2["status"] == "CHANGE_DETECTED"
    assert res2["regions_count"] >= 1

    # 3. Low quality
    res3 = suite.test_low_quality()
    assert res3["passed"] is True
    assert any("Low contrast" in w for w in res3["warnings_generated"])

    # 4. Illumination variation
    res4 = suite.test_illumination_variation()
    assert res4["passed"] is True
    assert res4["changed_pixels"] == 0

    # 5. Seasonal variation
    res5 = suite.test_seasonal_variation()
    assert res5["passed"] is True
    assert res5["status"] == "NO_SIGNIFICANT_CHANGE"

    # 6. Spatial misalignment
    res6 = suite.test_spatial_misalignment()
    assert res6["passed"] is True
    assert res6["total_pixels_evaluated"] == 10000

    # 7. Cross sensor
    res7 = suite.test_cross_sensor()
    assert res7["passed"] is True
    assert any("Cross-sensor" in w for w in res7["warnings"])
    assert res7["sensor_mismatch_penalty"] == 0.15


def test_robustness_suite_run_all(tmp_path):
    """Tests the aggregated run_all runner."""
    detector = DeterministicBiTemporalChangeDetector(output_dir=tmp_path)
    suite = RobustnessSuite(detector)

    summary = suite.run_all()
    assert summary["all_passed"] is True
    assert summary["total_scenarios"] == 7
    assert summary["passed_scenarios"] == 7
