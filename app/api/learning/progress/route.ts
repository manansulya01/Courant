import { NextResponse } from "next/server";
import { checkRateLimit, isSameOrigin } from "@/lib/security";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
export const runtime = "nodejs";
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view saved progress." }, { status: 401 });
  try {
    const db = await getDatabase();
    const records = await db.collection("learningProgress").find({ userId: user.id }).sort({ createdAt: -1 }).limit(100).toArray();
    const totals = await db.collection("learningProgress").aggregate([
      { $match: { userId: user.id } },
      { $group: { _id: null, sessions: { $sum: 1 }, minutes: { $sum: "$minutes" }, completed: { $sum: { $cond: ["$completed", 1, 0] } } } }
    ]).toArray();
    const skills = await db.collection("learningProgress").aggregate([
      { $match: { userId: user.id, skill: { $type: "string" }, score: { $type: "number" } } },
      { $sort: { createdAt: 1 } },
      { $group: { _id: "$skill", latestScore: { $last: "$score" }, attempts: { $sum: 1 } } }
    ]).toArray();
    return NextResponse.json({ records: records.map(({_id, ...r})=>({...r,id:_id.toString()})), totals: totals[0] || {sessions:0,minutes:0,completed:0}, skills: skills.map(s=>({skill:s._id,score:s.latestScore,attempts:s.attempts})) });
  } catch { return NextResponse.json({ error: "Could not load progress." }, { status: 503 }); }
}
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  try {
    const rate = await checkRateLimit(request, "progress-write", 60, 60);
    if (!rate.allowed) return NextResponse.json({ error: "Too many requests. Please wait before trying again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } });
  } catch {
    return NextResponse.json({ error: "Request protection is temporarily unavailable. Please try again." }, { status: 503 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to save learning progress." }, { status: 401 });
  try {
    const body = await request.json();
    const lesson = typeof body.lesson === "string" ? body.lesson.trim().slice(0, 120) : "";
    const scenario = typeof body.scenario === "string" ? body.scenario.trim().slice(0, 120) : "Practice";
    const skill = typeof body.skill === "string" && ["conversation","pronunciation","listening","vocabulary","clarity","confidence","presentation"].includes(body.skill) ? body.skill : "conversation";
    const minutes = Number.isInteger(body.minutes) ? Math.max(0, Math.min(180, body.minutes)) : 0;
    const score = Number.isFinite(body.score) ? Math.max(0, Math.min(100, Number(body.score))) : null;
    const completed = body.completed === true;
    if (!lesson) return NextResponse.json({ error: "A lesson name is required." }, { status: 400 });
    const db = await getDatabase();
    const record = { userId: user.id, lesson, scenario, skill, minutes, score, completed, createdAt: new Date() };
    const result = await db.collection("learningProgress").insertOne(record);
    return NextResponse.json({ record: { ...record, id: result.insertedId.toString() } }, { status: 201 });
  } catch { return NextResponse.json({ error: "Could not save progress." }, { status: 503 }); }
}
