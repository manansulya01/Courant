import { NextResponse } from "next/server";
import { checkRateLimit, isSameOrigin } from "@/lib/security";
import { getCurrentUser, createSupabaseServerClient } from "@/lib/auth";
import { readBoundedJson } from "@/lib/bounded-json";
import { generateClassJoinCode } from "@/lib/class-code";
export const runtime = "nodejs";
async function teacher() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Sign in to access teacher tools." }, { status: 401 }) };
  if (!["teacher", "admin"].includes(user.role)) return { error: NextResponse.json({ error: "Teacher permissions are required." }, { status: 403 }) };
  return { user };
}
async function limited(request: Request, scope: string) {
  try { const r = await checkRateLimit(request, scope, 40, 60); if (!r.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(r.retryAfter || 60) } }); return null; }
  catch { return NextResponse.json({ error: "Request protection is temporarily unavailable." }, { status: 503 }); }
}
export async function GET() {
  const access = await teacher(); if ("error" in access) return access.error;
  try {
    const s = await createSupabaseServerClient();
    const { data: classes, error: classError } = await s.from("classes").select("id,name,description,join_code,created_at,class_members(count)").eq("teacher_id", access.user.id).order("created_at", { ascending: false }).limit(100);
    if (classError) throw classError;
    const { data: assignments, error: assignmentError } = await s.from("assignments").select("id,class_id,teacher_id,title,instructions,due_at,created_at").eq("teacher_id", access.user.id).order("created_at", { ascending: false }).limit(100);
    if (assignmentError) throw assignmentError;
    const ids = (classes || []).map(c => c.id);
    const { data: memberships, error: memberError } = ids.length ? await s.from("class_members").select("class_id,student_id,joined_at").in("class_id", ids).limit(2000) : { data: [], error: null };
    if (memberError) throw memberError;
    return NextResponse.json({
      classes: (classes || []).map(c => ({ id:c.id, name:c.name, description:c.description, joinCode:c.join_code, studentIds:(memberships || []).filter(m => m.class_id === c.id).map(m => m.student_id), studentCount:Array.isArray(c.class_members)?c.class_members[0]?.count||0:0, createdAt:c.created_at })),
      assignments: (assignments || []).map(a => ({ id:a.id, classId:a.class_id, teacherId:a.teacher_id, title:a.title, instructions:a.instructions, dueDate:a.due_at, createdAt:a.created_at })),
      activity: (memberships || []).map(m => ({ userId:m.student_id, classId:m.class_id, joinedAt:m.joined_at, sessions:0, minutes:0 }))
    }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Could not load teacher workspace." }, { status: 503 }); }
}
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  const rate = await limited(request, "teacher-write"); if (rate) return rate;
  const parsed = await readBoundedJson(request, 16_000); if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const access = await teacher(); if ("error" in access) return access.error;
  try {
    const s = await createSupabaseServerClient(); const now = new Date().toISOString();
    if (parsed.value.type === "class") {
      const name = typeof parsed.value.name === "string" ? parsed.value.name.trim().slice(0,100) : "";
      const description = typeof parsed.value.description === "string" ? parsed.value.description.trim().slice(0,500) : "";
      if (name.length < 2) return NextResponse.json({ error: "Class name must be at least 2 characters." }, { status: 400 });
      let saved = null; let failure = null;
      for (let i=0;i<4;i++) {
        const { data, error } = await s.from("classes").insert({ teacher_id:access.user.id, name, description, join_code:generateClassJoinCode(), created_at:now, updated_at:now }).select("id,name,description,join_code,created_at").single();
        if (!error) { saved=data; break; } failure=error;
      }
      if (!saved) throw failure || new Error("Could not create class.");
      return NextResponse.json({ class:{ id:saved.id, name:saved.name, description:saved.description, joinCode:saved.join_code, studentCount:0, createdAt:saved.created_at } }, { status:201, headers:{"Cache-Control":"no-store"} });
    }
    if (parsed.value.type === "assignment") {
      const title = typeof parsed.value.title === "string" ? parsed.value.title.trim().slice(0,120) : "";
      const instructions = typeof parsed.value.instructions === "string" ? parsed.value.instructions.trim().slice(0,3000) : "";
      const classId = typeof parsed.value.classId === "string" ? parsed.value.classId : "";
      const due = typeof parsed.value.dueDate === "string" && parsed.value.dueDate ? new Date(parsed.value.dueDate) : null;
      if (title.length < 2 || !instructions || !/^[0-9a-f-]{36}$/i.test(classId)) return NextResponse.json({ error: "Add a title, instructions, and class." }, { status:400 });
      const { data: cls, error: classError } = await s.from("classes").select("id").eq("id",classId).eq("teacher_id",access.user.id).maybeSingle();
      if (classError || !cls) return NextResponse.json({ error:"Class not found." }, {status:404});
      const { data, error } = await s.from("assignments").insert({ teacher_id:access.user.id,class_id:classId,title,instructions,due_at:due&&!Number.isNaN(due.getTime())?due.toISOString():null,created_at:now,updated_at:now }).select("id,class_id,teacher_id,title,instructions,due_at,created_at").single();
      if (error) throw error;
      return NextResponse.json({ assignment:{id:data.id,classId:data.class_id,teacherId:data.teacher_id,title:data.title,instructions:data.instructions,dueDate:data.due_at,createdAt:data.created_at} }, {status:201});
    }
    return NextResponse.json({ error:"Choose class or assignment." }, {status:400});
  } catch { return NextResponse.json({ error:"Could not save teacher workspace changes." }, {status:503}); }
}
export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({error:"Request origin was not accepted."},{status:403});
  const rate=await limited(request,"teacher-delete");if(rate)return rate;
  const parsed=await readBoundedJson(request,4000);if(!parsed.ok)return NextResponse.json({error:parsed.error},{status:parsed.status});
  const id=typeof parsed.value.id==="string"?parsed.value.id:"";const type=parsed.value.type;
  if(!/^[0-9a-f-]{36}$/i.test(id)||!["class","assignment"].includes(String(type)))return NextResponse.json({error:"Invalid item."},{status:400});
  const access=await teacher();if("error" in access)return access.error;
  try {
    const s=await createSupabaseServerClient();
    if(type==="assignment"){const {data,error}=await s.from("assignments").delete().eq("id",id).eq("teacher_id",access.user.id).select("id").maybeSingle();if(error)throw error;if(!data)return NextResponse.json({error:"Assignment not found."},{status:404});}
    else {const {data,error}=await s.from("classes").delete().eq("id",id).eq("teacher_id",access.user.id).select("id").maybeSingle();if(error)throw error;if(!data)return NextResponse.json({error:"Class not found."},{status:404});}
    return NextResponse.json({ok:true});
  } catch {return NextResponse.json({error:"Could not delete this item."},{status:503});}
}
