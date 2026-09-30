import { NextResponse } from "next/server";
import { getLocations } from "@/lib/data";

export async function GET() {
  const locations = getLocations();
  return NextResponse.json({
    total_locations: locations.length,
    locations,
    source: "TerraLens Prototype Dataset (SIH-2026 Benchmark Sandbox)",
    mode: "controlled-benchmark",
  });
}
