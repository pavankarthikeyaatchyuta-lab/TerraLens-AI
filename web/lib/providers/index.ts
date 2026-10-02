/**
 * TerraLens AI - Satellite Data Provider Registry & Exports
 */

export * from "./satelliteProvider";
export * from "./copernicusSentinelProvider";
export * from "./mockBenchmarkProvider";

import { OperatingMode, SatelliteDataProvider } from "./satelliteProvider";
import { CopernicusSentinelProvider } from "./copernicusSentinelProvider";
import { MockBenchmarkProvider } from "./mockBenchmarkProvider";

let defaultCopernicusProvider: CopernicusSentinelProvider | null = null;
let defaultBenchmarkProvider: MockBenchmarkProvider | null = null;

/**
 * Factory returning the appropriate SatelliteDataProvider based on requested OperatingMode.
 */
export function getSatelliteProvider(mode: OperatingMode = "CONTROLLED_BENCHMARK"): SatelliteDataProvider {
  if (mode === "LIVE_PUBLIC_DATA") {
    if (!defaultCopernicusProvider) {
      defaultCopernicusProvider = new CopernicusSentinelProvider();
    }
    return defaultCopernicusProvider;
  }

  // Both CONTROLLED_BENCHMARK and OFFLINE_RESEARCH use deterministic local benchmark provider
  if (!defaultBenchmarkProvider) {
    defaultBenchmarkProvider = new MockBenchmarkProvider();
  }
  return defaultBenchmarkProvider;
}
