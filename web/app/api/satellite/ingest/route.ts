import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import path from "path";
import fs from "fs";
import util from "util";

const execFileAsync = util.promisify(execFile);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sceneId = typeof body.scene_id === "string" ? body.scene_id.trim() : `SCENE_INGEST_${Date.now()}`;
    const locationId = typeof body.location_id === "string" ? body.location_id.trim() : "LOC_EO_01_BHADLA_SOLAR";
    const acquisitionDate = typeof body.acquisition_date === "string" ? body.acquisition_date.trim() : new Date().toISOString().slice(0, 10);
    const platform = typeof body.platform === "string" ? body.platform.trim() : "Sentinel-2C";
    const sensor = typeof body.sensor === "string" ? body.sensor.trim() : "MSI L2A";
    const tags = Array.isArray(body.tags) ? body.tags.join(" ") : "solar energy";

    const candidateScripts = [
      path.join(process.cwd(), "scripts", "ingest_incremental.py"),
      path.join(process.cwd(), "..", "scripts", "ingest_incremental.py"),
    ];

    let scriptPath: string | null = null;
    for (const p of candidateScripts) {
      if (fs.existsSync(p)) {
        scriptPath = p;
        break;
      }
    }

    if (!scriptPath) {
      return NextResponse.json(
        { error: "Ingestion script not found on server" },
        { status: 500 }
      );
    }

    const { stdout } = await execFileAsync("python", [
      scriptPath,
      "--scene-id",
      sceneId,
      "--location-id",
      locationId,
      "--date",
      acquisitionDate,
      "--platform",
      platform,
      "--sensor",
      sensor,
      "--tags",
      tags,
    ], { timeout: 20000 });

    const parsed = JSON.parse(stdout);
    return NextResponse.json({
      success: true,
      mode: "incremental_vector_ingest",
      ...parsed,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Incremental ingestion failed", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
