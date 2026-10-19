import { NextResponse } from "next/server";
import { checkRateLimit, isSameOrigin } from "@/lib/security";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase, getMongoClient } from "@/lib/mongodb";
import { readBoundedJson } from "@/lib/bounded-json";
import { ObjectId } from "mongodb";

export const runtime = "nodejs";

async function teacher() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Sign in to access teacher tools." }, { status: 401 }) };
  if (!["teacher", "admin"].includes(user.role)) return { error: NextResponse.json({ error: "Teacher permissions are required." }, { status: 403 }) };
  return { user };
}

async function mutationRateLimit(request: Request, scope: string) {
  try {
    const rate = await checkRateLimit(request, scope, 40, 60);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before trying again." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } },
      );
    }
    return null;
  } catch {
    return NextResponse.json({ error: "Request protection is temporarily unavailable." }, { status: 503 });
  }
}

export async function GET() {
  const access = await teacher();
  if ("error" in access) return access.error;
  try {
    const db = await getDatabase();
    const classes = await db.collection("classes").find({ teacherId: access.user.id }).sort({ createdAt: -1 }).limit(100).toArray();
    const assignments = await db.collection("assignments").find({ teacherId: access.user.id }).sort({ createdAt: -1 }).limit(100).toArray();
    const classIds = classes.map((c) => c._id.toString());
    const progress = classIds.length ? await db.collection("learningProgress").aggregate([
      { $match: { classId: { $in: classIds } } },
      { $group: { _id: "$userId", sessions: { $sum: 1 }, minutes: { $sum: "$minutes" }, lastActive: { $max: "$createdAt" } } },
    ]).toArray() : [];
    return NextResponse.json({
      classes: classes.map(({ _id, ...c }) => ({ ...c, id: _id.toString() })),
      assignments: assignments.map(({ _id, ...a }) => ({ ...a, id: _id.toString() })),
      activity: progress.map((p) => ({ userId: p._id, sessions: p.sessions, minutes: p.minutes, lastActive: p.lastActive })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load teacher workspace." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  const limited = await mutationRateLimit(request, "teacher-write");
  if (limited) return limited;
  const parsed = await readBoundedJson(request, 16_000);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status, headers: { "Cache-Control": "no-store" } });
  const body = parsed.value;
  const access = await teacher();
  if ("error" in access) return access.error;

  try {
    const db = await getDatabase();
    const now = new Date();
    if (body.type === "class") {
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
      const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : "";
      if (name.length < 2) return NextResponse.json({ error: "Class name must be at least 2 characters." }, { status: 400 });
      const joinCode = Array.from(crypto.getRandomValues(new Uint8Array(4))).map((v) => (v % 36).toString(36)).join("").toUpperCase();
      const doc = { teacherId: access.user.id, name, description, joinCode, studentIds: [] as string[], createdAt: now, updatedAt: now };
      const result = await db.collection("classes").insertOne(doc);
      return NextResponse.json({ class: { ...doc, id: result.insertedId.toString() } }, { status: 201, headers: { "Cache-Control": "no-store" } });
    }
    if (body.type === "assignment") {
      const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
      const instructions = typeof body.instructions === "string" ? body.instructions.trim().slice(0, 3000) : "";
      const classId = typeof body.classId === "string" && ObjectId.isValid(body.classId) ? body.classId : "";
      const rawDueDate = typeof body.dueDate === "string" && body.dueDate ? new Date(body.dueDate) : null;
      if (title.length < 2 || !instructions || !classId) return NextResponse.json({ error: "Add a title, instructions, and class." }, { status: 400 });
      const cls = await db.collection("classes").findOne({ _id: new ObjectId(classId), teacherId: access.user.id }, { projection: { _id: 1 } });
      if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });
      const dueDate = rawDueDate && !Number.isNaN(rawDueDate.getTime()) ? rawDueDate : null;
      const doc = { teacherId: access.user.id, classId, title, instructions, dueDate, createdAt: now, updatedAt: now };
      const result = await db.collection("assignments").insertOne(doc);
      return NextResponse.json({ assignment: { ...doc, id: result.insertedId.toString() } }, { status: 201, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "Choose class or assignment." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Could not save teacher workspace changes." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  const limited = await mutationRateLimit(request, "teacher-delete");
  if (limited) return limited;
  const parsed = await readBoundedJson(request, 4_000);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status, headers: { "Cache-Control": "no-store" } });
  const body = parsed.value;
  if (typeof body.id !== "string" || !ObjectId.isValid(body.id) || !["class", "assignment"].includes(String(body.type))) {
    return NextResponse.json({ error: "Invalid item." }, { status: 400 });
  }
  const access = await teacher();
  if ("error" in access) return access.error;

  const client = await getMongoClient();
  const session = client.startSession();
  try {
    const db = client.db(process.env.MONGODB_DB || "courant");
    let notFound = false;
    await session.withTransaction(async () => {
      if (body.type === "assignment") {
        const assignment = await db.collection("assignments").findOne(
          { _id: new ObjectId(body.id as string), teacherId: access.user.id },
          { projection: { _id: 1 }, session },
        );
        if (!assignment) {
          notFound = true;
          return;
        }
        await db.collection("assignmentSubmissions").deleteMany({ assignmentId: body.id }, { session });
        await db.collection("assignments").deleteOne({ _id: assignment._id, teacherId: access.user.id }, { session });
        return;
      }

      const cls = await db.collection("classes").findOne(
        { _id: new ObjectId(body.id as string), teacherId: access.user.id },
        { projection: { _id: 1 }, session },
      );
      if (!cls) {
        notFound = true;
        return;
      }
      const classId = cls._id.toString();
      const assignments = await db.collection("assignments")
        .find({ classId, teacherId: access.user.id }, { projection: { _id: 1 }, session }).toArray();
      const assignmentIds = assignments.map((item) => item._id.toString());
      await db.collection("assignmentSubmissions").deleteMany({ assignmentId: { $in: assignmentIds } }, { session });
      await db.collection("assignments").deleteMany({ classId, teacherId: access.user.id }, { session });
      await db.collection("learningProgress").updateMany({ classId }, { $unset: { classId: "" } }, { session });
      await db.collection("classes").deleteOne({ _id: cls._id, teacherId: access.user.id }, { session });
    });
    if (notFound) return NextResponse.json({ error: "Item not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not delete item. No changes were committed." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  } finally {
    await session.endSession();
  }
}
