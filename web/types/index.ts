export interface BoundingBox {
  min_lat: number;
  min_lon: number;
  max_lat: number;
  max_lon: number;
}

export interface Location {
  location_id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  bounding_box: BoundingBox;
  primary_sensor: string;
  before_scene_id?: string;
  after_scene_id?: string;
  available_dates: string[];
  tags: string[];
  source?: string;
  extra_metadata?: Record<string, any>;
}

export interface Scene {
  scene_id: string;
  location_id: string;
  acquisition_date: string;
  sensor: string;
  platform?: string;
  cloud_percentage: number;
  tags: string[];
  image_path: string;
  resolution_meters?: number;
  vector_id?: number;
  similarity_score?: number;
}

export interface ChangeRegion {
  region_id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  area_pixels: number;
  relative_area: number;
  centroid: [number, number];
  bbox_geo?: Record<string, number>;
}

export interface ChangeDetectionResult {
  status: "CHANGE_DETECTED" | "NO_SIGNIFICANT_CHANGE" | "UNCERTAIN" | "INCOMPLETE_DATA";
  change_type: string;
  detector_name: string;
  detector_label: string;
  changed_pixels: number;
  total_pixels: number;
  change_ratio: number;
  change_regions: ChangeRegion[];
  confidence_score: number | null;
  confidence_breakdown?: {
    signal_contrast?: number;
    spatial_coherence?: number;
    alignment_penalty?: number;
    quality_penalty?: number;
    raw_confidence?: number;
    penalized_confidence?: number;
  };
  alignment_status?: string;
  mask_path?: string;
  heatmap_path?: string;
  overlay_path?: string;
  warnings?: string[];
  notes?: string;
}

export interface SearchResult {
  scene: Scene;
  location: Location;
  similarity_score: number;
  rank: number;
}

export interface ProvenanceStep {
  step_number: number;
  stage_name: string;
  timestamp: string;
  operator: string;
  parameters: Record<string, any>;
  status: "SUCCESS" | "WARNING" | "INFO";
  output_summary: string;
}

export interface AnalystAdjudication {
  verdict: "VERIFIED_TRUE_CHANGE" | "FALSE_ALARM" | "INCONCLUSIVE" | "PENDING";
  analyst_name: string;
  adjudicated_at: string;
  notes: string;
}

export interface SpatialFilter {
  bbox: {
    min_lat: number;
    min_lon: number;
    max_lat: number;
    max_lon: number;
  };
}

export interface TemporalFilter {
  startDate?: string;
  endDate?: string;
}

export interface PlatformFilter {
  platform?: string;
}

export interface SearchFilters {
  spatialFilter?: SpatialFilter;
  temporalFilter?: TemporalFilter;
  platformFilter?: PlatformFilter;
}
