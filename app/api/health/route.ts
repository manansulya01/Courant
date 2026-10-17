import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  let database: "ok" | "error" = "error";
  try {
    await (await getDatabase()).command({ ping: 1 });
    database = "ok";
  } catch {
    database = "error";
  }
  const authConfigured = Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32);
  const ready = database === "ok" && authConfigured;
  return NextResponse.json(
    {
      status: ready ? "ok" : "degraded",
      checks: {
        database,
        aiConfigured: Boolean(process.env.OPENAI_API_KEY),
        authConfigured,
      },
      latencyMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
