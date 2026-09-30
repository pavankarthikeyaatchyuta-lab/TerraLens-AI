import { NextResponse } from "next/server";
import { getEvaluationResults } from "@/lib/data";

export async function GET() {
  const evalData = getEvaluationResults();
  if (!evalData) {
    return NextResponse.json({ error: "Evaluation results not found" }, { status: 404 });
  }
  return NextResponse.json(evalData);
}
