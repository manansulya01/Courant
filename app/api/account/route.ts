import { NextResponse } from "next/server";
import { getCurrentUser, createSupabaseServerClient } from "@/lib/auth";
import { checkRateLimit, isSameOrigin } from "@/lib/security";
import { readBoundedJson } from "@/lib/bounded-json";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const user=await getCurrentUser(); if(!user)return NextResponse.json({error:"Sign in to export your data."},{status:401});
  try {
    const s=await createSupabaseServerClient();
    const [progress,portfolio,submissions,memberships,classes,assignments]=await Promise.all([
      s.from("learning_progress").select("*").eq("user_id",user.id).limit(5000),
      s.from("portfolio_items").select("*").eq("user_id",user.id).limit(1000),
      s.from("assignment_submissions").select("*").eq("user_id",user.id).limit(1000),
      s.from("class_members").select("class_id,joined_at").eq("student_id",user.id).limit(500),
      s.from("classes").select("*").eq("teacher_id",user.id).limit(500),
      s.from("assignments").select("*").eq("teacher_id",user.id).limit(2000)
    ]);
    for(const result of [progress,portfolio,submissions,memberships,classes,assignments])if(result.error)throw result.error;
    return NextResponse.json({exportedAt:new Date().toISOString(),profile:user,learningProgress:progress.data,portfolioItems:portfolio.data,assignmentSubmissions:submissions.data,joinedClasses:memberships.data,teachingClasses:classes.data,teachingAssignments:assignments.data},{headers:{"Cache-Control":"no-store","Content-Disposition":'attachment; filename="courant-data-export.json"'}});
  }catch{return NextResponse.json({error:"Could not export account data right now."},{status:503});}
}
export async function DELETE(request:Request) {
  if(!isSameOrigin(request))return NextResponse.json({error:"Request origin was not accepted."},{status:403});
  const user=await getCurrentUser();if(!user)return NextResponse.json({error:"Sign in before deleting your account."},{status:401});
  try{const r=await checkRateLimit(request,"account-delete",3,3600);if(!r.allowed)return NextResponse.json({error:"Too many deletion attempts. Try again later."},{status:429,headers:{"Retry-After":String(r.retryAfter||3600)}});}catch{return NextResponse.json({error:"Request protection is temporarily unavailable."},{status:503});}
  const parsed=await readBoundedJson(request,4096);if(!parsed.ok)return NextResponse.json({error:parsed.error},{status:parsed.status});
  if(typeof parsed.value.confirmEmail!=="string"||parsed.value.confirmEmail.trim().toLowerCase()!==user.email.toLowerCase())return NextResponse.json({error:"Enter your account email to confirm deletion."},{status:400});
  try{const s=await createSupabaseServerClient();const {error}=await s.rpc("delete_my_account");if(error)throw error;await s.auth.signOut();return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});}catch{return NextResponse.json({error:"Account deletion could not be completed. Contact support before retrying."},{status:503});}
}
