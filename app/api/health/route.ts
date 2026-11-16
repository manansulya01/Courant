import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const started = Date.now();
  let database: "ok" | "unavailable" = "unavailable";
  try {
    const s = await createSupabaseServerClient();
    const { error } = await s.from("profiles").select("id").limit(1);
    if (!error) database = "ok";
    else console.error("Courant health check: Supabase query failed", error.code || "unknown");
  } catch (error) { console.error("Courant health check: Supabase unavailable", error instanceof Error ? error.name : "UnknownError"); }
  const authConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const ready = database === "ok" && authConfigured;
  return NextResponse.json({ status:ready?"ok":"degraded",checks:{database,authConfigured,aiConfigured:Boolean(process.env.GEMINI_API_KEY||process.env.OPENAI_API_KEY)},latencyMs:Date.now()-started,timestamp:new Date().toISOString() },{status:ready?200:503,headers:{"Cache-Control":"no-store"}});
}
