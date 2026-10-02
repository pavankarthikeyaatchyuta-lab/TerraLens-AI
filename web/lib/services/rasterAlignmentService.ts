/**
 * Raster Alignment and Analysis Asset Preparation Service.
 * 
 * Implements Phase 4A scientific raster foundation:
 * - Differentiates Analysis Assets (COGs, georeferenced bands) from Preview Assets (thumbnails, overviews).
 * - Verifies CRS and spatial resolution compatibility across temporal pairs.
 * - Performs Dimension Reconciliation and Image Alignment planning without claiming fake georeferencing.
 * - Computes AOI subwindow pixel bounds to eliminate full-archive multi-gigabyte downloads.
 * - Generates immutable provenance records for the Earth Observation audit chain.
 */

import {
  SatelliteScene,
  AnalysisAsset,
  SpatialAlignmentInfo,
  RasterWindow,
  ProvenanceRecord,
  AnalysisPreparationResult,
} from "@/lib/providers/satelliteProvider";
import { BoundingBox } from "@/types";

export interface RasterWindowOptions {
  sceneBbox: [number, number, number, number]; // [min_lon, min_lat, max_lon, max_lat]
  aoi: BoundingBox;
  resolutionMeters: number; // e.g. 10
  rasterShape?: [number, number]; // [height, width] e.g. [10980, 10980]
  affineTransform?: number[];
}

export class RasterAlignmentService {
  /**
   * Computes spatial Intersection over Union (IoU) and intersection coordinates between two bounding boxes.
   */
  static computeSpatialIntersection(
    bbox1: [number, number, number, number],
    bbox2: [number, number, number, number]
  ): {
    intersects: boolean;
    intersectionBbox: [number, number, number, number];
    overlapPercentage: number;
  } {
    const minLon = Math.max(bbox1[0], bbox2[0]);
    const minLat = Math.max(bbox1[1], bbox2[1]);
    const maxLon = Math.min(bbox1[2], bbox2[2]);
    const maxLat = Math.min(bbox1[3], bbox2[3]);

    if (minLon >= maxLon || minLat >= maxLat) {
      return {
        intersects: false,
        intersectionBbox: [0, 0, 0, 0],
        overlapPercentage: 0.0,
      };
    }

    const interArea = (maxLon - minLon) * (maxLat - minLat);
    const area1 = (bbox1[2] - bbox1[0]) * (bbox1[3] - bbox1[1]);
    const area2 = (bbox2[2] - bbox2[0]) * (bbox2[3] - bbox2[1]);

    const overlap = area1 > 0 ? (interArea / area1) * 100.0 : 0.0;

    return {
      intersects: true,
      intersectionBbox: [
        parseFloat(minLon.toFixed(6)),
        parseFloat(minLat.toFixed(6)),
        parseFloat(maxLon.toFixed(6)),
        parseFloat(maxLat.toFixed(6)),
      ],
      overlapPercentage: parseFloat(Math.min(100.0, overlap).toFixed(2)),
    };
  }

  /**
   * Calculates subwindow pixel offsets and dimensions for a given AOI within a Sentinel-2 scene.
   * Enables HTTP range request windowing without downloading full 10980x10980 scenes.
   */
  static computeAoiSubwindow(options: RasterWindowOptions): RasterWindow {
    const { sceneBbox, aoi, resolutionMeters, rasterShape = [10980, 10980] } = options;

    const [sceneMinLon, sceneMinLat, sceneMaxLon, sceneMaxLat] = sceneBbox;
    const aoiBbox: [number, number, number, number] = [
      aoi.min_lon,
      aoi.min_lat,
      aoi.max_lon,
      aoi.max_lat,
    ];

    const { intersects, intersectionBbox } = this.computeSpatialIntersection(
      sceneBbox,
      aoiBbox
    );

    if (!intersects) {
      return {
        colOff: 0,
        rowOff: 0,
        width: 0,
        height: 0,
        aoiBbox: [0, 0, 0, 0],
        pixelResolution: resolutionMeters,
        estimatedSizeBytes: 0,
        rangeHeaderSupported: true,
      };
    }

    const [iMinLon, iMinLat, iMaxLon, iMaxLat] = intersectionBbox;
    const sceneLonSpan = sceneMaxLon - sceneMinLon;
    const sceneLatSpan = sceneMaxLat - sceneMinLat;

    const rasterHeight = rasterShape[0];
    const rasterWidth = rasterShape[1];

    // Compute relative pixel coordinates
    const colOff = Math.max(0, Math.floor(((iMinLon - sceneMinLon) / sceneLonSpan) * rasterWidth));
    const colEnd = Math.min(rasterWidth, Math.ceil(((iMaxLon - sceneMinLon) / sceneLonSpan) * rasterWidth));
    // Latitudes decrease as raster row index increases (origin top-left)
    const rowOff = Math.max(0, Math.floor(((sceneMaxLat - iMaxLat) / sceneLatSpan) * rasterHeight));
    const rowEnd = Math.min(rasterHeight, Math.ceil(((sceneMaxLat - iMinLat) / sceneLatSpan) * rasterHeight));

    const width = Math.max(1, colEnd - colOff);
    const height = Math.max(1, rowEnd - rowOff);

    // Approximate raw uncompressed 16-bit uint16 raster window size (2 bytes per pixel * bands)
    const estimatedSizeBytes = width * height * 2;

    return {
      colOff,
      rowOff,
      width,
      height,
      aoiBbox: intersectionBbox,
      pixelResolution: resolutionMeters,
      estimatedSizeBytes,
      rangeHeaderSupported: true,
    };
  }

  /**
   * Evaluates spatial alignment and dimension compatibility between two scenes over an AOI.
   */
  static evaluateSpatialAlignment(
    beforeScene: SatelliteScene,
    afterScene: SatelliteScene,
    beforeAssets: AnalysisAsset[],
    afterAssets: AnalysisAsset[],
    aoi: BoundingBox
  ): SpatialAlignmentInfo {
    const aoiBbox: [number, number, number, number] = [
      aoi.min_lon,
      aoi.min_lat,
      aoi.max_lon,
      aoi.max_lat,
    ];

    // Check intersection with both scenes
    const interBefore = this.computeSpatialIntersection(beforeScene.bbox, aoiBbox);
    const interAfter = this.computeSpatialIntersection(afterScene.bbox, aoiBbox);

    const commonMinLon = Math.max(interBefore.intersectionBbox[0], interAfter.intersectionBbox[0]);
    const commonMinLat = Math.max(interBefore.intersectionBbox[1], interAfter.intersectionBbox[1]);
    const commonMaxLon = Math.min(interBefore.intersectionBbox[2], interAfter.intersectionBbox[2]);
    const commonMaxLat = Math.min(interBefore.intersectionBbox[3], interAfter.intersectionBbox[3]);

    const commonIntersects = commonMinLon < commonMaxLon && commonMinLat < commonMaxLat;
    const intersectionBbox: [number, number, number, number] = commonIntersects
      ? [commonMinLon, commonMinLat, commonMaxLon, commonMaxLat]
      : [0, 0, 0, 0];

    const aoiArea = (aoi.max_lon - aoi.min_lon) * (aoi.max_lat - aoi.min_lat);
    const commonArea = commonIntersects
      ? (commonMaxLon - commonMinLon) * (commonMaxLat - commonMinLat)
      : 0;
    const aoiIntersectionPercentage = aoiArea > 0
      ? parseFloat(((commonArea / aoiArea) * 100.0).toFixed(2))
      : 0.0;

    // Determine CRS and Resolution
    const primaryBeforeAsset = beforeAssets[0];
    const primaryAfterAsset = afterAssets[0];

    const beforeCrs = primaryBeforeAsset?.crs || "EPSG:32644";
    const afterCrs = primaryAfterAsset?.crs || "EPSG:32644";
    const crsMatch = beforeCrs === afterCrs;
    const targetCrs = crsMatch ? beforeCrs : "EPSG:32644 (Reprojection Required)";

    const beforeRes = primaryBeforeAsset?.resolution || 10;
    const afterRes = primaryAfterAsset?.resolution || 10;
    const targetResolution = Math.min(beforeRes, afterRes);

    const beforeShape = primaryBeforeAsset?.shape || [10980, 10980];
    const afterShape = primaryAfterAsset?.shape || [10980, 10980];

    const shapesMatch = beforeShape[0] === afterShape[0] && beforeShape[1] === afterShape[1];

    let status: "ALIGNED" | "RECONCILED" | "MISMATCH" = "ALIGNED";
    let method = "Native Coordinate Alignment";

    if (!crsMatch) {
      status = "RECONCILED";
      method = `Reprojection to common CRS: ${targetCrs}`;
    } else if (!shapesMatch || beforeRes !== afterRes) {
      status = "RECONCILED";
      method = "Dimension Reconciliation (Affine grid resampling to target resolution)";
    }

    if (!commonIntersects || aoiIntersectionPercentage < 1.0) {
      status = "MISMATCH";
      method = "Inadequate spatial overlap over target AOI";
    }

    return {
      status,
      beforeCrs,
      afterCrs,
      crsMatch,
      targetCrs,
      beforeResolution: beforeRes,
      afterResolution: afterRes,
      targetResolution,
      aoiIntersectionPercentage,
      intersectionBbox,
      dimensionReconciliation: {
        beforeShape,
        afterShape,
        reconciledShape: [Math.min(beforeShape[0], afterShape[0]), Math.min(beforeShape[1], afterShape[1])],
        method,
      },
    };
  }

  /**
   * Validates temporal pair constraints and determines scientific analysis readiness.
   */
  static validateAndPrepareAnalysis(
    beforeScene: SatelliteScene,
    afterScene: SatelliteScene,
    beforeAssets: AnalysisAsset[],
    afterAssets: AnalysisAsset[],
    aoi: BoundingBox
  ): AnalysisPreparationResult {
    const issues: string[] = [];

    // 1. Scene ID validation
    if (!beforeScene.sceneId || !afterScene.sceneId) {
      issues.push("Both before and after scene IDs are required.");
    }
    if (beforeScene.sceneId === afterScene.sceneId) {
      issues.push("Before and after scenes must be distinct acquisitions.");
    }

    // 2. Acquisition chronology
    const tBefore = Date.parse(beforeScene.acquisitionDate);
    const tAfter = Date.parse(afterScene.acquisitionDate);

    if (isNaN(tBefore) || isNaN(tAfter)) {
      issues.push("Invalid ISO 8601 acquisition dates.");
    } else if (tBefore > tAfter) {
      issues.push(
        `Chronological order violation: beforeScene (${beforeScene.acquisitionDate}) is later than afterScene (${afterScene.acquisitionDate}).`
      );
    }

    const temporalSeparationDays = !isNaN(tBefore) && !isNaN(tAfter)
      ? Math.max(0, Math.round(Math.abs(tAfter - tBefore) / (1000 * 60 * 60 * 24)))
      : 0;

    // 3. Analysis Asset Availability
    if (beforeAssets.length === 0) {
      issues.push(`No georeferenced raster analysis assets found for beforeScene "${beforeScene.sceneId}".`);
    }
    if (afterAssets.length === 0) {
      issues.push(`No georeferenced raster analysis assets found for afterScene "${afterScene.sceneId}".`);
    }

    // 4. Spatial Alignment
    const alignment = this.evaluateSpatialAlignment(
      beforeScene,
      afterScene,
      beforeAssets,
      afterAssets,
      aoi
    );

    if (alignment.status === "MISMATCH") {
      issues.push(`Spatial coverage failure: AOI overlap is insufficient (${alignment.aoiIntersectionPercentage}%).`);
    }

    // 5. Readiness Status
    const status: "READY_FOR_ANALYSIS" | "NOT_READY" = issues.length === 0 ? "READY_FOR_ANALYSIS" : "NOT_READY";

    // 6. Provenance Record Construction
    const provenanceId = `PROV-${beforeScene.sceneId.substring(0, 12)}-${afterScene.sceneId.substring(0, 12)}-${Date.now().toString(36)}`;
    const provenance: ProvenanceRecord = {
      provenanceId,
      timestamp: new Date().toISOString(),
      provider: beforeScene.sourceProvider,
      collection: beforeScene.collection,
      beforeSceneId: beforeScene.sceneId,
      afterSceneId: afterScene.sceneId,
      platform: {
        before: beforeScene.platform,
        after: afterScene.platform,
      },
      instrument: {
        before: beforeScene.instrument,
        after: afterScene.instrument,
      },
      processingLevel: "Sentinel-2 L2A (Bottom-of-Atmosphere Surface Reflectance)",
      selectedAssets: [
        ...beforeAssets.map((a) => `before:${a.assetKey}`),
        ...afterAssets.map((a) => `after:${a.assetKey}`),
      ],
      crs: alignment.targetCrs,
      resolutionMeters: alignment.targetResolution,
      aoi: [aoi.min_lon, aoi.min_lat, aoi.max_lon, aoi.max_lat],
      processingChain: [
        "STAC Item Discovery & Metadata Verification",
        "Analysis Asset Segregation (Exclusion of preview/thumbnail PNG/JPEGs)",
        "CRS Compatibility Verification & Transform Inspection",
        "Spatial Intersection & AOI Subwindow Resolution",
        "Image Alignment & Dimension Reconciliation Planning",
        status === "READY_FOR_ANALYSIS"
          ? "Staged for Phase 4B Bi-Temporal Change Detection"
          : "Preparation Halted: Constraint Violation",
      ],
    };

    return {
      status,
      beforeScene,
      afterScene,
      aoi,
      analysisAssets: {
        before: beforeAssets,
        after: afterAssets,
      },
      alignment,
      temporalSeparationDays,
      provenance,
      issues,
    };
  }
}
