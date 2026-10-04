"""CLI script for staging and indexing local satellite imagery for TerraLens AI (SIH26227).

Allows offline / air-gapped staging of imagery (GeoTIFF, COG, TIFF, PNG, JPEG),
validating file headers, generating checksums, preserving spatial metadata,
and updating the standardized staging manifest.
"""

import sys
import argparse
import logging
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from terralens.app.services.staging_service import LocalDatasetStagingService

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("terralens.stage_local_dataset")


def main():
    parser = argparse.ArgumentParser(
        description="TerraLens AI — Local Dataset Staging & Ingestion CLI (SIH26227)"
    )
    parser.add_argument(
        "--source-dir",
        type=str,
        required=True,
        help="Path to directory containing satellite imagery to stage (GeoTIFF, COG, PNG, JPEG)",
    )
    parser.add_argument(
        "--staging-dir",
        type=str,
        default=None,
        help="Destination directory for manifest and staged metadata (default: data/staged)",
    )
    parser.add_argument(
        "--sensor",
        type=str,
        default="Sentinel-2 MSI L2A",
        help="Default sensor name if sidecar metadata is absent (default: Sentinel-2 MSI L2A)",
    )
    parser.add_argument(
        "--no-recursive",
        action="store_true",
        help="Disable recursive scanning of subdirectories",
    )
    parser.add_argument(
        "--rebuild-manifest",
        action="store_true",
        help="Rebuild manifest from scratch instead of incremental staging",
    )

    args = parser.parse_args()

    source_path = Path(args.source_dir)
    staging_path = Path(args.staging_dir) if args.staging_dir else None

    print("=" * 70)
    print("TerraLens AI — Local Dataset Staging & Ingestion Pipeline")
    print("SIH26227 — Offline / Air-Gapped Satellite Archive Ingestion")
    print("=" * 70)
    print(f"Source Directory:     {source_path.resolve()}")
    print(f"Staging Directory:    {staging_path.resolve() if staging_path else 'data/staged (default)'}")
    print(f"Recursive Scanning:   {not args.no_recursive}")
    print(f"Incremental Mode:     {not args.rebuild_manifest}")
    print(f"Default Sensor:       {args.sensor}")
    print("-" * 70)

    service = LocalDatasetStagingService(staging_dir=staging_path)

    result = service.stage_local_scenes(
        source_dir=source_path,
        recursive=not args.no_recursive,
        incremental=not args.rebuild_manifest,
        default_sensor=args.sensor,
    )

    print("\nStaging Execution Results:")
    print(f"  - Status:                   {result['status']}")
    print(f"  - Total Files Scanned:      {result['total_scanned']}")
    print(f"  - Newly Staged Scenes:      {result['newly_staged']}")
    print(f"  - Duplicates Skipped:       {result['skipped_duplicates']}")
    print(f"  - Corrupted Files Skipped:  {result['corrupted_skipped']}")
    print(f"  - Total Manifest Scenes:    {result['cumulative_staged_scenes']}")
    print(f"  - Manifest Location:        {result['manifest_path']}")
    print("=" * 70)
    print("Local staging pipeline finished successfully.\n")


if __name__ == "__main__":
    main()
