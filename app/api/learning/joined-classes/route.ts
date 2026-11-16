import { NextResponse } from "next/server";
import { getCurrentUser, createSupabaseServerClient } from "@/lib/auth";
export const runtime = "nodejs";
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view classes." }, { status: 401 });
  try {
    const supabase = await createSupabaseServerClient();
    if (user.role === "student") {
      const { data: memberships, error: memberError } = await supabase.from("class_members").select("class_id,joined_at").eq("student_id", user.id).order("joined_at", { ascending: false });
      if (memberError) throw memberError;
      const ids = (memberships || []).map(x => x.class_id);
      if (!ids.length) return NextResponse.json({ classes: [] });
      const { data, error } = await supabase.from("classes").select("id,name,description,teacher_id,created_at").in("id", ids);
      if (error) throw error;
      return NextResponse.json({ classes: (data || []).map(c => ({ ...c, studentCount: 1 })) });
    }
    if (!["teacher", "admin"].includes(user.role)) return NextResponse.json({ error: "Your account cannot view classes." }, { status: 403 });
    const { data, error } = await supabase.from("classes").select("id,name,description,teacher_id,join_code,created_at,class_members(count)").eq("teacher_id", user.id).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return NextResponse.json({ classes: (data || []).map(c => ({ ...c, studentCount: Array.isArray(c.class_members) ? c.class_members[0]?.count || 0 : 0 })) });
  } catch { return NextResponse.json({ error: "Could not load classes." }, { status: 503 }); }
}
