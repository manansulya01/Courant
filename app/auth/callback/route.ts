import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requested = url.searchParams.get("next") || "/login";
  let next = "/login";
  try { const candidate = new URL(requested, url.origin); if (candidate.origin === url.origin) next = candidate.pathname + candidate.search + candidate.hash; } catch { /* Invalid redirect targets fall back to sign-in. */ }
  if (!code) return NextResponse.redirect(new URL("/login?error=confirmation", url.origin));
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) return NextResponse.redirect(new URL("/login?error=confirmation", url.origin));
    if (data.user.user_metadata?.requested_role === "teacher") {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
      if (profile?.role !== "teacher") { await supabase.auth.signOut(); return NextResponse.redirect(new URL("/signup?error=teacher-invite", url.origin)); }
    }
    return NextResponse.redirect(new URL(data.user.user_metadata?.requested_role === "teacher" ? "/teacher" : next, url.origin));
  } catch { return NextResponse.redirect(new URL("/login?error=confirmation", url.origin)); }
}
