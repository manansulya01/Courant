import { NextResponse } from "next/server";
import { checkRateLimit, isSameOrigin } from "@/lib/security";
import { getDatabase } from "@/lib/mongodb";
import { hashPassword, safeUser, setSession, type Role } from "@/lib/auth";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  try {
    const rate = await checkRateLimit(request, "auth-register", 5, 60);
    if (!rate.allowed) return NextResponse.json({ error: "Too many requests. Please wait before trying again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } });
  } catch {
    return NextResponse.json({ error: "Request protection is temporarily unavailable. Please try again." }, { status: 503 });
  }
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const requestedRole = typeof body.role === "string" ? body.role : "student";
    if (name.length < 2 || name.length > 80) return NextResponse.json({ error: "Enter a name between 2 and 80 characters." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    if (password.length < 10 || password.length > 128) return NextResponse.json({ error: "Use a password between 10 and 128 characters." }, { status: 400 });
    let role: Role = "student";
    if (requestedRole === "teacher") {
      const invite = process.env.COURANT_TEACHER_INVITE_CODE;
      if (!invite || typeof body.inviteCode !== "string" || body.inviteCode.length > 200 || body.inviteCode !== invite) return NextResponse.json({ error: "A valid school-issued teacher invitation is required." }, { status: 403 });
      role = "teacher";
    } else if (requestedRole !== "student") return NextResponse.json({ error: "Choose a supported account type." }, { status: 400 });
    const db = await getDatabase();
    const users = db.collection("users");
    await users.createIndex({ email: 1 }, { unique: true, name: "unique_user_email" });
    const existing = await users.findOne({ email }, { projection: { _id: 1 } });
    if (existing) return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    const now = new Date();
    const userDoc = { name, email, passwordHash: await hashPassword(password), role, status: "active", createdAt: now, updatedAt: now };
    const result = await users.insertOne(userDoc);
    const user = { _id: result.insertedId, name, email, role };
    await setSession(safeUser(user));
    return NextResponse.json({ user: safeUser(user) }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    return NextResponse.json({ error: "Account creation is temporarily unavailable. Check server configuration and try again." }, { status: 503 });
  }
}
