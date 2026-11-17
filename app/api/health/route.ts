import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const started = Date.now();
  let database: "ok" | "unavailable" = "unavailable";
  let rateLimitRpc: "ok" | "unavailable" = "unavailable";
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("profiles").select("id").limit(1);
    if (!error) database = "ok";
    else console.error("Courant health check: database query failed", error.code || "unknown");
  } catch (error) {
    console.error("Courant health check: database unavailable", error instanceof Error ? error.name : "UnknownError");
  }
  const authConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const rateLimitConfigured = Boolean(process.env.COURANT_RATE_LIMIT_SECRET);
  try {
    await checkRateLimit(new Request(request.url), "health", 1_000_000, 60);
    rateLimitRpc = "ok";
  } catch (error) {
    console.error("Courant health check: rate-limit unavailable", error instanceof Error ? error.name : "UnknownError");
  }
  const aiConfigured = Boolean(process.env.GEMINI_API_KEY);
  const ready = database === "ok" && authConfigured && rateLimitConfigured && rateLimitRpc === "ok";
  return NextResponse.json({
    status: ready ? "ok" : "degraded",
    checks: { database, authConfigured, rateLimitConfigured, rateLimitRpc, aiConfigured },
    latencyMs: Date.now() - started,
    timestamp: new Date().toISOString(),
  }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
