import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { safeUser, setSession, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password || email.length > 254 || password.length > 128) return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
    const db = await getDatabase();
    const user = await db.collection("users").findOne({ email, status: "active" });
    if (!user || typeof user.passwordHash !== "string" || !(await verifyPassword(password, user.passwordHash))) return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    const safe = safeUser(user as any);
    await setSession(safe);
    await db.collection("users").updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date(), updatedAt: new Date() } });
    return NextResponse.json({ user: safe });
  } catch {
    return NextResponse.json({ error: "Sign-in is temporarily unavailable. Please try again." }, { status: 503 });
  }
}
