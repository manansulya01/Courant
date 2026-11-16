import { NextResponse } from "next/server";
import { checkRateLimit, isSameOrigin } from "@/lib/security";
import { createSupabaseServerClient } from "@/lib/auth";
import { readBoundedJson } from "@/lib/bounded-json";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  try {
    const rate = await checkRateLimit(request, "auth-login", 8, 60);
    if (!rate.allowed) return NextResponse.json({ error: "Too many requests. Please wait before trying again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } });
  } catch { return NextResponse.json({ error: "Request protection is temporarily unavailable. Please try again." }, { status: 503 }); }
  const parsed = await readBoundedJson(request, 8_000);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status, headers: { "Cache-Control": "no-store" } });
  const email = typeof parsed.value.email === "string" ? parsed.value.email.trim().toLowerCase() : "";
  const password = typeof parsed.value.password === "string" ? parsed.value.password : "";
  const expectedRole = parsed.value.expectedRole === "teacher" ? "teacher" : "student";
  if (!email || !password || email.length > 254 || password.length > 128) return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return NextResponse.json({ error: "Email or password is incorrect, or the email has not been confirmed." }, { status: 401 });
    const { data: profile, error: profileError } = await supabase.from("profiles").select("id,name,email,role,status").eq("id", data.user.id).single();
    if (profileError || !profile || profile.status !== "active") { await supabase.auth.signOut(); return NextResponse.json({ error: "This account is not active." }, { status: 403 }); }
    if (expectedRole === "teacher" && !["teacher", "admin"].includes(profile.role)) { await supabase.auth.signOut(); return NextResponse.json({ error: "This account does not have teacher permissions." }, { status: 403 }); }
    if (expectedRole === "student" && !["student", "parent"].includes(profile.role)) { await supabase.auth.signOut(); return NextResponse.json({ error: "Choose the teacher sign-in option for this account." }, { status: 403 }); }
    return NextResponse.json({ user: { id: profile.id, name: profile.name, email: profile.email, role: profile.role } }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Sign-in is temporarily unavailable. Please try again." }, { status: 503 }); }
}
