import { NextResponse } from "next/server";
import { getFixtures } from "@/lib/analysis";
import { isSportId } from "@/lib/sports";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sport = searchParams.get("sport") ?? "football";
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  if (!isSportId(sport)) {
    return NextResponse.json({ error: "sport invalido" }, { status: 400 });
  }
  try {
    const fixtures = await getFixtures(sport, date);
    return NextResponse.json({ sport, date, count: fixtures.length, fixtures });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
