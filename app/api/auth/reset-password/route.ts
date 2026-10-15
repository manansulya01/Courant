import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { hashPassword } from "@/lib/auth";
import { checkRateLimit, isSameOrigin } from "@/lib/security";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  try {
    const rate = await checkRateLimit(request, "password-reset", 8, 3600);
    if (!rate.allowed) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter || 3600) } });
  } catch { return NextResponse.json({ error: "Password reset is temporarily unavailable." }, { status: 503 }); }
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 10 || password.length > 128) return NextResponse.json({ error: "Use a password between 10 and 128 characters." }, { status: 400 });
    if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const db = await getDatabase();
    const record = await db.collection("passwordResetTokens").findOne({ tokenHash, usedAt: null, expiresAt: { $gt: new Date() } });
    if (!record || !ObjectId.isValid(record.userId)) return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
    const passwordHash = await hashPassword(password);
    const result = await db.collection("users").updateOne({ _id: new ObjectId(record.userId), status: "active" }, { $set: { passwordHash, updatedAt: new Date(), passwordChangedAt: new Date() } });
    if (!result.matchedCount) return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
    await db.collection("passwordResetTokens").deleteMany({ userId: record.userId });
    return NextResponse.json({ ok: true, message: "Password changed. You can now sign in with your new password." }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Could not reset your password. Request a new link and try again." }, { status: 503 }); }
}
