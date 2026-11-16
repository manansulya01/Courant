import { NextResponse } from "next/server";
import { getCurrentUser, createSupabaseServerClient } from "@/lib/auth";
import { checkRateLimit, isSameOrigin } from "@/lib/security";
import { readBoundedJson } from "@/lib/bounded-json";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view submissions." }, { status: 401 });
  try {
    const supabase = await createSupabaseServerClient();
    let query = supabase.from("assignment_submissions").select("id,assignment_id,user_id,student_name,content,status,feedback,score,submitted_at,reviewed_at,updated_at").order("updated_at", { ascending: false }).limit(1000);
    if (user.role === "student") query = query.eq("user_id", user.id);
    else if (["teacher", "admin"].includes(user.role)) {
      const { data: assignments, error: assignmentError } = await supabase.from("assignments").select("id").eq("teacher_id", user.id).limit(1000);
      if (assignmentError) throw assignmentError;
      const ids = (assignments || []).map(x => x.id);
      if (!ids.length) return NextResponse.json({ submissions: [] });
      query = query.in("assignment_id", ids);
    } else return NextResponse.json({ error: "Teacher permissions are required." }, { status: 403 });
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ submissions: data || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Could not load submissions." }, { status: 503 }); }
}
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  try { const rate = await checkRateLimit(request, "assignment-submit", 20, 60); if (!rate.allowed) return NextResponse.json({ error: "Too many submissions." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } }); }
  catch { return NextResponse.json({ error: "Request protection is temporarily unavailable." }, { status: 503 }); }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to submit work." }, { status: 401 });
  if (user.role !== "student") return NextResponse.json({ error: "Only student accounts can submit assignments." }, { status: 403 });
  const parsed = await readBoundedJson(request, 16_000);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const assignmentId = typeof parsed.value.assignmentId === "string" ? parsed.value.assignmentId : "";
  const content = typeof parsed.value.content === "string" ? parsed.value.content.trim().slice(0, 12000) : "";
  if (!/^[0-9a-f-]{36}$/i.test(assignmentId) || !content) return NextResponse.json({ error: "Choose an assignment and enter your work." }, { status: 400 });
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("assignment_submissions").upsert({ assignment_id: assignmentId, user_id: user.id, student_name: user.name, content, status: "submitted", feedback: null, score: null, submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "assignment_id,user_id" }).select("id,assignment_id,user_id,content,status,submitted_at").single();
    if (error) throw error;
    return NextResponse.json({ submission: data }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Could not submit this assignment. Check that you have joined its class." }, { status: 403 }); }
}
export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  try { const rate = await checkRateLimit(request, "submission-review", 40, 60); if (!rate.allowed) return NextResponse.json({ error: "Too many reviews." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } }); }
  catch { return NextResponse.json({ error: "Request protection is temporarily unavailable." }, { status: 503 }); }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to review work." }, { status: 401 });
  if (!["teacher", "admin"].includes(user.role)) return NextResponse.json({ error: "Teacher permissions are required." }, { status: 403 });
  const parsed = await readBoundedJson(request, 8_000);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const id = typeof parsed.value.id === "string" ? parsed.value.id : "";
  const feedback = typeof parsed.value.feedback === "string" ? parsed.value.feedback.trim().slice(0, 3000) : "";
  const score = parsed.value.score === null || parsed.value.score === "" || parsed.value.score === undefined ? null : Number(parsed.value.score);
  if (!/^[0-9a-f-]{36}$/i.test(id) || (score !== null && (!Number.isFinite(score) || score < 0 || score > 100))) return NextResponse.json({ error: "Invalid submission or score." }, { status: 400 });
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("assignment_submissions").update({ feedback, score, status: "reviewed", reviewed_by: user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Could not save this review." }, { status: 403 }); }
}
