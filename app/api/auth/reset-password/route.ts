import { NextResponse } from "next/server";
import { checkRateLimit, isSameOrigin } from "@/lib/security";
import { createSupabaseServerClient } from "@/lib/auth";
import { readBoundedJson } from "@/lib/bounded-json";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  try { const rate = await checkRateLimit(request, "password-reset", 8, 3600); if (!rate.allowed) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter || 3600) } }); }
  catch { return NextResponse.json({ error: "Password reset is temporarily unavailable." }, { status: 503 }); }
  const parsed = await readBoundedJson(request, 4_000);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status, headers: { "Cache-Control": "no-store" } });
  const password = typeof parsed.value.password === "string" ? parsed.value.password : "";
  if (password.length < 10 || password.length > 128) return NextResponse.json({ error: "Use a password between 10 and 128 characters." }, { status: 400 });
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Open the password reset link from your email first." }, { status: 401 });
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return NextResponse.json({ error: "Could not reset your password. Request a new link and try again." }, { status: 400 });
    await supabase.auth.signOut();
    return NextResponse.json({ ok: true, message: "Password changed. You can now sign in with your new password." }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Could not reset your password. Request a new link and try again." }, { status: 503 }); }
}
