import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export type Role = "student" | "teacher" | "parent" | "admin";
export type SafeUser = { id: string; name: string; email: string; role: Role };

export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured.");
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(values) {
        try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        catch { /* Server Components cannot mutate cookies; API routes can. */ }
      },
    },
  });
}

export async function getCurrentUser(): Promise<SafeUser | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("id,name,email,role,status").eq("id", user.id).maybeSingle();
    if (profileError || !profile || profile.status !== "active" ||
      !["student", "teacher", "parent", "admin"].includes(profile.role)) return null;
    return { id: profile.id, name: profile.name || "", email: profile.email || user.email || "", role: profile.role as Role };
  } catch { return null; }
}

export async function clearSession() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}

export async function safeUser(user: SafeUser): Promise<SafeUser> { return user; }
