import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, isSameOrigin } from "@/lib/security";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view submissions." }, { status: 401 });
  try {
    const db = await getDatabase();
    if (user.role === "student") {
      const own = await db.collection("assignmentSubmissions").find({ userId: user.id }).sort({ updatedAt: -1 }).limit(200).toArray();
      return NextResponse.json({ submissions: own.map(({ _id, ...item }) => ({ ...item, id: _id.toString() })) });
    }
    if (!["teacher", "admin"].includes(user.role)) return NextResponse.json({ error: "Teacher permissions are required." }, { status: 403 });
    const assignments = await db.collection("assignments").find({ teacherId: user.id }, { projection: { _id: 1 } }).limit(1000).toArray();
    const assignmentIds = assignments.map((item) => item._id.toString());
    const submissions = assignmentIds.length ? await db.collection("assignmentSubmissions").find({ assignmentId: { $in: assignmentIds } }).sort({ updatedAt: -1 }).limit(1000).toArray() : [];
    return NextResponse.json({ submissions: submissions.map(({ _id, ...item }) => ({ ...item, id: _id.toString() })) });
  } catch {
    return NextResponse.json({ error: "Could not load submissions." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  try {
    const rate = await checkRateLimit(request, "assignment-submit", 20, 60);
    if (!rate.allowed) return NextResponse.json({ error: "Too many submissions. Please wait before trying again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } });
  } catch {
    return NextResponse.json({ error: "Request protection is temporarily unavailable." }, { status: 503 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to submit work." }, { status: 401 });
  if (user.role !== "student") return NextResponse.json({ error: "Only student accounts can submit assignments." }, { status: 403 });
  try {
    const body = await request.json();
    const assignmentId = typeof body.assignmentId === "string" && ObjectId.isValid(body.assignmentId) ? body.assignmentId : "";
    const content = typeof body.content === "string" ? body.content.trim().slice(0, 12000) : "";
    if (!assignmentId || content.length < 1) return NextResponse.json({ error: "Choose an assignment and enter your work." }, { status: 400 });
    const db = await getDatabase();
    const assignment = await db.collection("assignments").findOne({ _id: new ObjectId(assignmentId) });
    if (!assignment) return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
    const cls = await db.collection("classes").findOne({ _id: new ObjectId(assignment.classId), studentIds: user.id }, { projection: { _id: 1 } });
    if (!cls) return NextResponse.json({ error: "Join the assignment's class before submitting." }, { status: 403 });
    const now = new Date();
    const submission = { assignmentId, userId: user.id, studentName: user.name, content, status: "submitted", feedback: null, score: null, submittedAt: now, updatedAt: now };
    const result = await db.collection("assignmentSubmissions").findOneAndUpdate(
      { assignmentId, userId: user.id },
      { $set: submission, $setOnInsert: { createdAt: now } },
      { upsert: true, returnDocument: "after" },
    );
    const saved = result && result._id ? result : await db.collection("assignmentSubmissions").findOne({ assignmentId, userId: user.id });
    return NextResponse.json({ submission: saved ? { ...submission, id: saved._id.toString() } : submission }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not submit this assignment." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  try {
    const rate = await checkRateLimit(request, "submission-review", 40, 60);
    if (!rate.allowed) return NextResponse.json({ error: "Too many reviews. Please wait before trying again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } });
  } catch {
    return NextResponse.json({ error: "Request protection is temporarily unavailable." }, { status: 503 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to review work." }, { status: 401 });
  if (!["teacher", "admin"].includes(user.role)) return NextResponse.json({ error: "Teacher permissions are required." }, { status: 403 });
  try {
    const body = await request.json();
    if (typeof body.id !== "string" || !ObjectId.isValid(body.id)) return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
    const feedback = typeof body.feedback === "string" ? body.feedback.trim().slice(0, 3000) : "";
    const score = body.score === null || body.score === "" || body.score === undefined ? null : Number(body.score);
    if (score !== null && (!Number.isFinite(score) || score < 0 || score > 100)) return NextResponse.json({ error: "Score must be between 0 and 100." }, { status: 400 });
    const db = await getDatabase();
    const submission = await db.collection("assignmentSubmissions").findOne({ _id: new ObjectId(body.id) });
    if (!submission) return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    const assignment = await db.collection("assignments").findOne({ _id: new ObjectId(submission.assignmentId), teacherId: user.id }, { projection: { _id: 1 } });
    if (!assignment) return NextResponse.json({ error: "You cannot review this submission." }, { status: 403 });
    await db.collection("assignmentSubmissions").updateOne({ _id: submission._id }, { $set: { feedback, score, status: "reviewed", reviewedBy: user.id, reviewedAt: new Date(), updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not save this review." }, { status: 503 });
  }
}
