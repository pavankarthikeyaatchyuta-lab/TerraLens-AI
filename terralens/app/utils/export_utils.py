"""Export utilities for generating auditable intelligence reports in JSON and Markdown formats."""

import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from terralens.app.models.evidence import Evidence
from terralens.app.models.change import ChangeDetectionResult


def export_evidence_json(evidence: Evidence) -> str:
    """Serializes the evidence dossier into a formatted JSON string."""
    return evidence.model_dump_json(indent=2)


def export_evidence_markdown(
    evidence: Evidence,
    change_result: Optional[ChangeDetectionResult] = None,
) -> str:
    """Generates an operational intelligence markdown report from the evidence record."""
    now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    # Format detected regions
    regions_str = "None detected."
    if change_result and change_result.change_regions:
        reg_lines = []
        for r in change_result.change_regions:
            reg_lines.append(
                f"- **Region #{r.region_id}:** Area = {r.area_pixels:,} px ({r.relative_area * 100:.2f}% scene), "
                f"Centroid = ({r.centroid[0]:.1f}, {r.centroid[1]:.1f}), BBox = [{r.x}, {r.y}, {r.width}x{r.height}]"
            )
        regions_str = "\n".join(reg_lines)

    # Warnings
    warnings_str = "None"
    if evidence.warnings:
        warnings_str = "\n".join(f"- ⚠️ {w}" for w in evidence.warnings)

    # Provenance steps
    prov_lines = []
    if evidence.provenance and evidence.provenance.steps:
        for idx, s in enumerate(evidence.provenance.steps):
            details_str = ", ".join(f"{k}={v}" for k, v in s.details.items())
            prov_lines.append(f"{idx + 1}. **[{s.step_name}]** ({s.status}) — {details_str} *(UTC: {s.timestamp})*")
    prov_str = "\n".join(prov_lines) if prov_lines else "Provenance trace not recorded."

    conf_pct = f"{evidence.change_confidence * 100:.1f}%" if evidence.change_confidence is not None else "Not computed"
    ratio_pct = f"{evidence.change_ratio * 100:.2f}%" if evidence.change_ratio is not None else "N/A"
    px_str = f"{evidence.changed_pixels:,} of {evidence.total_pixels:,} px" if evidence.changed_pixels is not None else "N/A"

    report = f"""# TERRALENS AI
# MULTI-TEMPORAL SATELLITE INTELLIGENCE REPORT

**Dossier ID:** `{evidence.evidence_id}`  
**Generated:** `{now_utc}`  
**Processing Status:** `{evidence.processing_status}`  

---

## 1. Geospatial & Target Identification
- **Location Name:** {evidence.location_name}
- **Location ID:** `{evidence.location_id}`
- **Coordinates:** {evidence.coordinates}
- **Sensor Family:** {evidence.sensor}
- **Data Archive Source:** {evidence.source}

---

## 2. Temporal Acquisition Context
- **Baseline Observation (T1):** {evidence.before_date}
- **Monitoring Observation (T2):** {evidence.after_date}
- **Natural Language / Reference Query:** *"{evidence.provenance.query or 'Catalog Direct Selection'}"*
- **Retrieval Engine:** {evidence.retrieval_method} (Model: {evidence.embedding_model or 'N/A'})
- **Semantic Similarity Score:** {f"{evidence.similarity_score:.4f}" if evidence.similarity_score is not None else 'N/A'}

---

## 3. Multi-Temporal Change Analysis Results
- **Change Verdict:** **{evidence.change_type or 'Pending Analysis'}**
- **Analytical Confidence Score:** **{conf_pct}** *(Model-derived metric based on contrast, cluster coherence, and dynamic range; not a calibrated probability)*
- **Changed Surface Extent:** {px_str} ({ratio_pct} of scene)
- **Extracted Change Clusters:** {evidence.detected_regions_count or 0} components
- **Image Quality / Contrast Score:** {f"{evidence.quality_score:.3f}" if evidence.quality_score is not None else 'N/A'}
- **Cloud & Shadow Mask:** *Cloud/shadow mask unavailable for this prototype scene (morphological noise suppression applied).*

### Detected Spatial Change Regions
{regions_str}

### Operational Advisory & False-Alarm Warnings
{warnings_str}

---

## 4. Persisted Visual Artifacts
- **Binary Change Mask:** `{evidence.change_mask_path or 'Not generated'}`
- **Difference Heatmap:** `{evidence.difference_image_path or 'Not generated'}`
- **Highlight Overlay:** `{evidence.overlay_image_path or 'Not generated'}`

---

## 5. Human-in-the-Loop Analyst Adjudication
- **Adjudication Decision:** **{evidence.analyst_decision}**
- **Analyst Operational Notes:**  
  >{evidence.analyst_notes or 'Pending review commentary.'}

---

## 6. Verifiable Chain of Custody (Provenance Trace)
**Trace ID:** `{evidence.provenance.trace_id if evidence.provenance else 'N/A'}`

{prov_str}

---
*Report generated automatically by TerraLens AI Intelligence Engine (SIH-2026).*
"""
    return report
