import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { checkRateLimit, isSameOrigin } from "@/lib/security";
import { getDatabase } from "@/lib/mongodb";
import { readBoundedJson } from "@/lib/bounded-json";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  try {
    const rate = await checkRateLimit(request, "password-reset-request", 5, 3600);
    if (!rate.allowed) return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter || 3600) } });
  } catch { return NextResponse.json({ error: "Recovery is temporarily unavailable." }, { status: 503 }); }
  try {
    const parsed = await readBoundedJson(request, 4_000);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status, headers: { "Cache-Control": "no-store" } });
    const body = parsed.value;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    const db = await getDatabase();
    const user = await db.collection("users").findOne({ email, status: "active" }, { projection: { _id: 1, email: 1, name: 1 } });
    const key = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (user && key && from) {
      const token = randomBytes(32).toString("base64url");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const now = new Date();
      await db.collection("passwordResetTokens").deleteMany({ userId: user._id.toString() });
      await db.collection("passwordResetTokens").insertOne({ userId: user._id.toString(), tokenHash, createdAt: now, expiresAt: new Date(now.getTime() + 30 * 60 * 1000), usedAt: null });
      await db.collection("passwordResetTokens").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "password_reset_expiry" });
      const base = process.env.APP_URL || new URL(request.url).origin;
      const link = new URL("/reset-password", base); link.searchParams.set("token", token);
      const sent = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [user.email], subject: "Reset your Courant password", html: '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;line-height:1.6"><h1>Reset your Courant password</h1><p>Hello ' + String(user.name || "there").replace(/[&<>"]/g, "") + ',</p><p>Use the link below to choose a new password. It expires in 30 minutes and can only be used once.</p><p><a href="' + link.toString() + '">Reset password</a></p><p>If you did not request this, you can ignore this email.</p></div>' }) });
      if (!sent.ok) return NextResponse.json({ error: "Email delivery is not available right now. Please try again later." }, { status: 503 });
    }
    return NextResponse.json({ ok: true, message: "If an active account matches that email and recovery email is configured, a reset link will arrive shortly." }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Recovery is temporarily unavailable. Please try again later." }, { status: 503 }); }
}
