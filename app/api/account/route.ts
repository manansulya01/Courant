import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, isSameOrigin } from "@/lib/security";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to export your data." }, { status: 401 });
  try {
    const db = await getDatabase();
    const [progress, portfolio, submissions, memberships, classes, assignments] = await Promise.all([
      db.collection("learningProgress").find({ userId: user.id }).limit(5000).toArray(),
      db.collection("portfolioItems").find({ userId: user.id }).limit(1000).toArray(),
      db.collection("assignmentSubmissions").find({ userId: user.id }).limit(1000).toArray(),
      db.collection("classes").find({ studentIds: user.id }, { projection: { name: 1, description: 1, teacherId: 1, createdAt: 1 } }).limit(500).toArray(),
      user.role === "teacher" || user.role === "admin" ? db.collection("classes").find({ teacherId: user.id }).limit(500).toArray() : Promise.resolve([]),
      user.role === "teacher" || user.role === "admin" ? db.collection("assignments").find({ teacherId: user.id }).limit(2000).toArray() : Promise.resolve([]),
    ]);
    const clean = (items: Array<Record<string, unknown>>) => items.map(({ _id, passwordHash, ...item }) => ({ ...item, id: _id instanceof ObjectId ? _id.toString() : undefined }));
    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      profile: user,
      learningProgress: clean(progress as unknown as Array<Record<string, unknown>>),
      portfolioItems: clean(portfolio as unknown as Array<Record<string, unknown>>),
      assignmentSubmissions: clean(submissions as unknown as Array<Record<string, unknown>>),
      joinedClasses: clean(memberships as unknown as Array<Record<string, unknown>>),
      teachingClasses: clean(classes as unknown as Array<Record<string, unknown>>),
      teachingAssignments: clean(assignments as unknown as Array<Record<string, unknown>>),
    }, { headers: { "Cache-Control": "no-store", "Content-Disposition": 'attachment; filename="courant-data-export.json"' } });
  } catch {
    return NextResponse.json({ error: "Could not export account data right now." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  try {
    const rate = await checkRateLimit(request, "account-delete", 3, 3600);
    if (!rate.allowed) return NextResponse.json({ error: "Too many deletion attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter || 3600) } });
  } catch {
    return NextResponse.json({ error: "Request protection is temporarily unavailable." }, { status: 503 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in before deleting your account." }, { status: 401 });
  try {
    const body = await request.json();
    if (typeof body.confirmEmail !== "string" || body.confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json({ error: "Enter your account email to confirm deletion." }, { status: 400 });
    }
    const db = await getDatabase();
    const ownedClasses = await db.collection("classes").find({ teacherId: user.id }, { projection: { _id: 1 } }).toArray();
    const ownedClassIds = ownedClasses.map((item) => item._id.toString());
    const ownedAssignments = await db.collection("assignments").find({ $or: [{ teacherId: user.id }, { classId: { $in: ownedClassIds } }] }, { projection: { _id: 1 } }).toArray();
    const ownedAssignmentIds = ownedAssignments.map((item) => item._id.toString());
    await Promise.all([
      db.collection("learningProgress").deleteMany({ userId: user.id }),
      db.collection("portfolioItems").deleteMany({ userId: user.id }),
      db.collection("assignmentSubmissions").deleteMany({ $or: [{ userId: user.id }, { assignmentId: { $in: ownedAssignmentIds } }] }),
      db.collection("classes").updateMany({ studentIds: user.id }, { $pull: { studentIds: { $in: [user.id] } }, $set: { updatedAt: new Date() } }),
      db.collection("classes").deleteMany({ teacherId: user.id }),
      db.collection("assignments").deleteMany({ _id: { $in: ownedAssignments.map((item) => item._id) } }),
    ]);
    await db.collection("users").deleteOne({ _id: new ObjectId(user.id) });
    const response = NextResponse.json({ ok: true });
    response.cookies.set("courant_session", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  } catch {
    return NextResponse.json({ error: "Account deletion could not be completed. Contact support before retrying." }, { status: 503 });
  }
}
