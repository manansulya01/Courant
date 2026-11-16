import { NextResponse } from "next/server";
import { checkRateLimit, isSameOrigin } from "@/lib/security";
import { getCurrentUser, createSupabaseServerClient } from "@/lib/auth";
import { readBoundedJson } from "@/lib/bounded-json";
export const runtime = "nodejs";
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view saved progress." }, { status: 401 });
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("learning_progress").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(500);
    if (error) throw error;
    const records = data || [];
    const totals = records.reduce((a, r) => ({ sessions: a.sessions + 1, minutes: a.minutes + Number(r.data?.minutes || 0), completed: a.completed + (r.status === "completed" ? 1 : 0) }), { sessions: 0, minutes: 0, completed: 0 });
    const skills = Object.values(records.reduce((acc: Record<string, {skill:string;score:number;attempts:number}>, r) => {
      const skill = typeof r.data?.skill === "string" ? r.data.skill : "conversation";
      const item = acc[skill] || (acc[skill] = { skill, score: 0, attempts: 0 });
      item.attempts++; if (typeof r.score === "number") item.score = r.score; return acc;
    }, {}));
    return NextResponse.json({ records: records.map(r => ({ id: r.id, lesson: r.lesson_id, scenario: r.data?.scenario || "Practice", skill: r.data?.skill || "conversation", minutes: r.data?.minutes || 0, score: r.score, completed: r.status === "completed", createdAt: r.updated_at })), totals, skills });
  } catch { return NextResponse.json({ error: "Could not load progress." }, { status: 503 }); }
}
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  try { const rate = await checkRateLimit(request, "progress-write", 60, 60); if (!rate.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } }); }
  catch { return NextResponse.json({ error: "Request protection is temporarily unavailable." }, { status: 503 }); }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to save learning progress." }, { status: 401 });
  const parsed = await readBoundedJson(request, 8_000);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const lesson = typeof parsed.value.lesson === "string" ? parsed.value.lesson.trim().slice(0, 120) : "";
  const scenario = typeof parsed.value.scenario === "string" ? parsed.value.scenario.trim().slice(0, 120) : "Practice";
  const skill = typeof parsed.value.skill === "string" && ["conversation","pronunciation","listening","vocabulary","clarity","confidence","presentation"].includes(parsed.value.skill) ? parsed.value.skill : "conversation";
  const minutes = typeof parsed.value.minutes === "number" && Number.isInteger(parsed.value.minutes) ? Math.max(0, Math.min(180, parsed.value.minutes)) : 0;
  const score = typeof parsed.value.score === "number" && Number.isFinite(parsed.value.score) ? Math.max(0, Math.min(100, parsed.value.score)) : null;
  const completed = parsed.value.completed === true;
  if (!lesson) return NextResponse.json({ error: "A lesson name is required." }, { status: 400 });
  try {
    const supabase = await createSupabaseServerClient();
    const payload = { user_id: user.id, lesson_id: lesson, status: completed ? "completed" : "in_progress", score, data: { scenario, skill, minutes }, completed_at: completed ? new Date().toISOString() : null, updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from("learning_progress").upsert(payload, { onConflict: "user_id,lesson_id" }).select("id,lesson_id,status,score,data,updated_at").single();
    if (error) throw error;
    return NextResponse.json({ record: { id: data.id, lesson: data.lesson_id, scenario, skill, minutes, score, completed, createdAt: data.updated_at } }, { status: 201 });
  } catch { return NextResponse.json({ error: "Could not save progress." }, { status: 503 }); }
}
