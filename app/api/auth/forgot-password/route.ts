import { NextResponse } from "next/server";
import { checkRateLimit, isSameOrigin } from "@/lib/security";
import { createSupabaseServerClient } from "@/lib/auth";
import { readBoundedJson } from "@/lib/bounded-json";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  try { const rate = await checkRateLimit(request, "password-reset-request", 5, 3600); if (!rate.allowed) return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter || 3600) } }); }
  catch { return NextResponse.json({ error: "Recovery is temporarily unavailable." }, { status: 503 }); }
  const parsed = await readBoundedJson(request, 4_000);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status, headers: { "Cache-Control": "no-store" } });
  const email = typeof parsed.value.email === "string" ? parsed.value.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  try {
    const supabase = await createSupabaseServerClient();
    const redirectTo = new URL("/auth/callback?next=%2Freset-password", new URL(request.url).origin).toString();
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return NextResponse.json({ error: "Password recovery email could not be sent. Please try again later." }, { status: 503 });
    return NextResponse.json({ ok: true, message: "If an account matches that email, a password reset link will arrive shortly." }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Recovery is temporarily unavailable. Please try again later." }, { status: 503 }); }
}
