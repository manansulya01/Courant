import { NextResponse } from "next/server";
import { getCurrentUser, createSupabaseServerClient } from "@/lib/auth";
export const runtime = "nodejs";
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view assignments." }, { status: 401 });
  try {
    const supabase = await createSupabaseServerClient();
    let query = supabase.from("assignments").select("id,class_id,teacher_id,title,description,instructions,due_at,created_at,updated_at").order("created_at", { ascending: false }).limit(100);
    if (user.role === "student") {
      const { data: memberships, error } = await supabase.from("class_members").select("class_id").eq("student_id", user.id);
      if (error) throw error;
      const ids = (memberships || []).map(x => x.class_id);
      if (!ids.length) return NextResponse.json({ assignments: [] });
      query = query.in("class_id", ids);
    } else if (["teacher", "admin"].includes(user.role)) query = query.eq("teacher_id", user.id);
    else return NextResponse.json({ error: "Your account cannot view class assignments." }, { status: 403 });
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ assignments: (data || []).map(a => ({ id:a.id, classId:a.class_id, teacherId:a.teacher_id, title:a.title, description:a.description, instructions:a.instructions, dueDate:a.due_at, createdAt:a.created_at, updatedAt:a.updated_at })) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Could not load assignments." }, { status: 503 }); }
}
