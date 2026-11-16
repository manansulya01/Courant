import { NextResponse } from "next/server";
import { checkRateLimit, isSameOrigin } from "@/lib/security";
import { getCurrentUser, createSupabaseServerClient } from "@/lib/auth";
import { readBoundedJson } from "@/lib/bounded-json";
export const runtime = "nodejs";
export async function GET() {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Sign in to open your portfolio." }, { status: 401 });
  try { const s = await createSupabaseServerClient(); const { data, error } = await s.from("portfolio_items").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(100); if (error) throw error; return NextResponse.json({ items: (data || []).map(x => ({ id:x.id, userId:x.user_id, title:x.title, kind:x.data?.kind || "Writing", content:x.data?.content || "", status:x.data?.status || "draft", createdAt:x.created_at, updatedAt:x.updated_at })) }); }
  catch { return NextResponse.json({ error: "Could not load portfolio." }, { status: 503 }); }
}
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  try { const r = await checkRateLimit(request, "portfolio-write", 40, 60); if (!r.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(r.retryAfter || 60) } }); } catch { return NextResponse.json({ error: "Request protection is temporarily unavailable." }, { status: 503 }); }
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Sign in to save portfolio work." }, { status: 401 });
  const parsed = await readBoundedJson(request, 16_000); if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const title = typeof parsed.value.title === "string" ? parsed.value.title.trim().slice(0,120) : "";
  const kind = typeof parsed.value.kind === "string" ? parsed.value.kind.trim().slice(0,40) : "Writing";
  const content = typeof parsed.value.content === "string" ? parsed.value.content.trim().slice(0,12000) : "";
  const status = parsed.value.status === "published" ? "published" : "draft";
  if (title.length < 2 || !content) return NextResponse.json({ error: "Add a title and some work before saving." }, { status: 400 });
  try { const s = await createSupabaseServerClient(); const now = new Date().toISOString(); const { data, error } = await s.from("portfolio_items").insert({ user_id:user.id, title, description:kind, data:{kind,content,status}, updated_at:now }).select("id,created_at,updated_at").single(); if(error) throw error; return NextResponse.json({ item:{id:data.id,userId:user.id,title,kind,content,status,createdAt:data.created_at,updatedAt:data.updated_at} }, {status:201}); }
  catch { return NextResponse.json({ error: "Could not save this project." }, { status:503 }); }
}
export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  try { const r = await checkRateLimit(request, "portfolio-write", 40, 60); if (!r.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(r.retryAfter || 60) } }); } catch { return NextResponse.json({ error: "Request protection is temporarily unavailable." }, { status: 503 }); }
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: "Sign in to update portfolio work." }, { status:401 });
  const parsed = await readBoundedJson(request, 16_000); if (!parsed.ok) return NextResponse.json({ error:parsed.error }, {status:parsed.status});
  const id = typeof parsed.value.id === "string" ? parsed.value.id : ""; if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({error:"Invalid project."},{status:400});
  try { const s=await createSupabaseServerClient(); const {data:current,error:readError}=await s.from("portfolio_items").select("data,title,description").eq("id",id).eq("user_id",user.id).single(); if(readError||!current)return NextResponse.json({error:"Project not found."},{status:404}); const data={...current.data}; if(typeof parsed.value.kind==="string")data.kind=parsed.value.kind.trim().slice(0,40); if(typeof parsed.value.content==="string")data.content=parsed.value.content.trim().slice(0,12000); if(parsed.value.status==="draft"||parsed.value.status==="published")data.status=parsed.value.status; const title=typeof parsed.value.title==="string"&&parsed.value.title.trim()?parsed.value.title.trim().slice(0,120):current.title; const {error}=await s.from("portfolio_items").update({title,description:data.kind||current.description,data,updated_at:new Date().toISOString()}).eq("id",id).eq("user_id",user.id); if(error)throw error; return NextResponse.json({ok:true}); } catch { return NextResponse.json({error:"Could not update project."},{status:503}); }
}
export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({error:"Request origin was not accepted."},{status:403});
  try { const r=await checkRateLimit(request,"portfolio-write",40,60); if(!r.allowed)return NextResponse.json({error:"Too many requests."},{status:429}); } catch{return NextResponse.json({error:"Request protection is temporarily unavailable."},{status:503});}
  const user=await getCurrentUser(); if(!user)return NextResponse.json({error:"Sign in to delete portfolio work."},{status:401});
  const parsed=await readBoundedJson(request,4000); if(!parsed.ok)return NextResponse.json({error:parsed.error},{status:parsed.status});
  const id=typeof parsed.value.id==="string"?parsed.value.id:""; if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:"Invalid project."},{status:400});
  try{const s=await createSupabaseServerClient();const {data,error}=await s.from("portfolio_items").delete().eq("id",id).eq("user_id",user.id).select("id").maybeSingle();if(error)throw error;if(!data)return NextResponse.json({error:"Project not found."},{status:404});return NextResponse.json({ok:true});}catch{return NextResponse.json({error:"Could not delete project."},{status:503});}
}
