import { NextResponse } from "next/server";
import { getCurrentUser, createSupabaseServerClient } from "@/lib/auth";
import { checkRateLimit, isSameOrigin } from "@/lib/security";
import { readBoundedJson } from "@/lib/bounded-json";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  try { const rate = await checkRateLimit(request, "class-join", 8, 60); if (!rate.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } }); }
  catch { return NextResponse.json({ error: "Request protection is temporarily unavailable." }, { status: 503 }); }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to join a class." }, { status: 401 });
  if (user.role !== "student") return NextResponse.json({ error: "Only student accounts can join a class." }, { status: 403 });
  const parsed = await readBoundedJson(request, 1_024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const code = typeof parsed.value.code === "string" ? parsed.value.code.replace(/[^a-z0-9]/gi, "").toUpperCase() : "";
  if (code.length < 4 || code.length > 12) return NextResponse.json({ error: "Enter a valid class code." }, { status: 400 });
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("join_class_by_code", { p_code: code, p_secret: process.env.COURANT_RATE_LIMIT_SECRET });
    if (error || !data?.[0]) return NextResponse.json({ error: "That class code was not found or could not be joined." }, { status: 404 });
    return NextResponse.json({ ok: true, class: { id: data[0].class_id, name: data[0].class_name } }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Could not join class." }, { status: 503 }); }
}
