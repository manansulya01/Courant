import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";
import { checkRateLimit, isSameOrigin } from "@/lib/security";

export const runtime = "nodejs";

async function readCode(request: Request): Promise<string | NextResponse> {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > 1_024) {
    return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  }
  if (!request.body) {
    return NextResponse.json({ error: "Enter the four-character class code." }, { status: 400 });
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 1_024) {
        await reader.cancel();
        return NextResponse.json({ error: "Request is too large." }, { status: 413 });
      }
      chunks.push(value);
    }
  } catch {
    return NextResponse.json({ error: "Could not read request body." }, { status: 400 });
  }

  try {
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || Array.isArray(body) || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const code = "code" in body && typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!/^[A-Z0-9]{4}$/.test(code)) {
      return NextResponse.json({ error: "Enter the four-character class code." }, { status: 400 });
    }
    return code;
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  }

  try {
    const rate = await checkRateLimit(request, "class-join", 8, 60);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before trying again." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } },
      );
    }
  } catch {
    return NextResponse.json({ error: "Request protection is temporarily unavailable. Please try again." }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to join a class." }, { status: 401 });
  if (user.role !== "student") {
    return NextResponse.json({ error: "Only student accounts can join a class." }, { status: 403 });
  }

  const code = await readCode(request);
  if (code instanceof NextResponse) return code;

  try {
    const db = await getDatabase();
    const cls = await db.collection("classes").findOne(
      { joinCode: code },
      { projection: { _id: 1, name: 1 } },
    );
    if (!cls) return NextResponse.json({ error: "That class code was not found." }, { status: 404 });

    await db.collection("classes").updateOne(
      { _id: cls._id },
      { $addToSet: { studentIds: user.id }, $set: { updatedAt: new Date() } },
    );
    return NextResponse.json(
      { ok: true, class: { id: cls._id.toString(), name: cls.name } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Could not join class." }, { status: 503 });
  }
}
