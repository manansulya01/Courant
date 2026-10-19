import { NextResponse } from "next/server";
import { checkRateLimit, isSameOrigin } from "@/lib/security";
import { getDatabase } from "@/lib/mongodb";
import { safeUser, setSession, verifyPassword } from "@/lib/auth";
import { readBoundedJson } from "@/lib/bounded-json";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  try {
    const rate = await checkRateLimit(request, "auth-login", 8, 60);
    if (!rate.allowed) return NextResponse.json({ error: "Too many requests. Please wait before trying again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } });
  } catch {
    return NextResponse.json({ error: "Request protection is temporarily unavailable. Please try again." }, { status: 503 });
  }
  try {
    const parsed = await readBoundedJson(request, 8_000);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status, headers: { "Cache-Control": "no-store" } });
    const body = parsed.value;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const expectedRole = body.expectedRole === "teacher" ? "teacher" : "student";
    if (!email || !password || email.length > 254 || password.length > 128) return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
    const db = await getDatabase();
    const user = await db.collection("users").findOne({ email, status: "active" });
    if (!user || typeof user.passwordHash !== "string" || !(await verifyPassword(password, user.passwordHash))) return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    if (expectedRole === "teacher" && !["teacher","admin"].includes(user.role)) return NextResponse.json({ error: "This account does not have teacher permissions." }, { status: 403 });
    if (expectedRole === "student" && !["student","parent"].includes(user.role)) return NextResponse.json({ error: "Choose the teacher sign-in option for this account." }, { status: 403 });
    const safe = safeUser(user as any);
    await setSession(safe);
    await db.collection("users").updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date(), updatedAt: new Date() } });
    return NextResponse.json({ user: safe });
  } catch {
    return NextResponse.json({ error: "Sign-in is temporarily unavailable. Please try again." }, { status: 503 });
  }
}
