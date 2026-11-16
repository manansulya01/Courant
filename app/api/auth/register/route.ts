import { NextResponse } from "next/server";
import { checkRateLimit, isSameOrigin } from "@/lib/security";
import { createSupabaseServerClient } from "@/lib/auth";
import { readBoundedJson } from "@/lib/bounded-json";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  try {
    const rate = await checkRateLimit(request, "auth-register", 5, 60);
    if (!rate.allowed) return NextResponse.json({ error: "Too many requests. Please wait before trying again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } });
  } catch { return NextResponse.json({ error: "Request protection is temporarily unavailable. Please try again." }, { status: 503 }); }
  const parsed = await readBoundedJson(request, 8_000);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status, headers: { "Cache-Control": "no-store" } });
  const name = typeof parsed.value.name === "string" ? parsed.value.name.trim().slice(0, 80) : "";
  const email = typeof parsed.value.email === "string" ? parsed.value.email.trim().toLowerCase() : "";
  const password = typeof parsed.value.password === "string" ? parsed.value.password : "";
  if (name.length < 2) return NextResponse.json({ error: "Enter a name between 2 and 80 characters." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (password.length < 10 || password.length > 128) return NextResponse.json({ error: "Use a password between 10 and 128 characters." }, { status: 400 });
  if (parsed.value.role === "teacher") return NextResponse.json({ error: "Teacher accounts must be provisioned by a Courant administrator. Student registration cannot grant teacher privileges." }, { status: 403 });
  if (parsed.value.role && parsed.value.role !== "student") return NextResponse.json({ error: "Choose a supported account type." }, { status: 400 });
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
    if (error) return NextResponse.json({ error: error.message.includes("already registered") ? "An account with that email already exists." : "Could not create your account. Check your details and try again." }, { status: error.message.includes("already registered") ? 409 : 400 });
    if (!data.user) return NextResponse.json({ error: "Account creation could not be confirmed. Please try again." }, { status: 503 });
    return NextResponse.json({ user: { id: data.user.id, name, email, role: "student" }, requiresEmailConfirmation: !data.session, message: data.session ? "Your account is ready." : "Check your email to confirm your account before signing in." }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Account creation is temporarily unavailable." }, { status: 503 }); }
}
