import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  let database: "ok" | "not_configured" | "unavailable" = "unavailable";
  if (!process.env.MONGODB_URI) {
    database = "not_configured";
  } else {
    try {
      await (await getDatabase()).command({ ping: 1 });
      database = "ok";
    } catch (error) {
      // Keep the public health response generic; log only the error class, never a connection string.
      console.error("Courant health check: database ping failed", error instanceof Error ? error.name : "UnknownError");
      database = "unavailable";
    }
  }
  const authConfigured = Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32);
  const ready = database === "ok" && authConfigured;
  return NextResponse.json(
    {
      status: ready ? "ok" : "degraded",
      checks: {
        database,
        aiConfigured: Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY),
        authConfigured,
      },
      latencyMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
