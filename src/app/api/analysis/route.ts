import { NextResponse } from "next/server";
import { buildMatchAnalysis } from "@/lib/analysis";
import { isSportId } from "@/lib/sports";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sport = searchParams.get("sport") ?? "";
  const id = Number(searchParams.get("id"));
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const lg = searchParams.get("lg") ?? undefined;

  if (!isSportId(sport) || !id) {
    return NextResponse.json({ error: "params: sport, id, date" }, { status: 400 });
  }
  try {
    const analysis = await buildMatchAnalysis(sport, id, date, lg);
    return NextResponse.json(analysis);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
