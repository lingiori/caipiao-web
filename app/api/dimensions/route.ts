import { NextResponse } from "next/server";
import { getAllDimensionSteps } from "@/lib/supabase";

export const runtime = "edge";

export async function GET() {
  try {
    const rows = await getAllDimensionSteps();
    return NextResponse.json({ rows });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
