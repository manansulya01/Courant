import { NextResponse } from "next/server";
import { checkRateLimit, isSameOrigin } from "@/lib/security";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { readBoundedJson } from "@/lib/bounded-json";
export const runtime = "nodejs";
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to open your portfolio." }, { status: 401 });
  try {
    const items = await (await getDatabase()).collection("portfolioItems").find({ userId: user.id }).sort({ updatedAt: -1 }).limit(100).toArray();
    return NextResponse.json({ items: items.map(({_id,...item})=>({...item,id:_id.toString()})) });
  } catch { return NextResponse.json({ error: "Could not load portfolio." }, { status: 503 }); }
}
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  try {
    const rate = await checkRateLimit(request, "portfolio-write", 40, 60);
    if (!rate.allowed) return NextResponse.json({ error: "Too many requests. Please wait before trying again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } });
  } catch {
    return NextResponse.json({ error: "Request protection is temporarily unavailable. Please try again." }, { status: 503 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to save portfolio work." }, { status: 401 });
  try {
    const parsed = await readBoundedJson(request, 16_000);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status, headers: { "Cache-Control": "no-store" } });
    const body = parsed.value;
    const title = typeof body.title === "string" ? body.title.trim().slice(0,120) : "";
    const kind = typeof body.kind === "string" ? body.kind.trim().slice(0,40) : "Writing";
    const content = typeof body.content === "string" ? body.content.trim().slice(0,12000) : "";
    const status = body.status === "published" ? "published" : "draft";
    if (title.length < 2 || !content) return NextResponse.json({ error: "Add a title and some work before saving." }, { status: 400 });
    const now = new Date();
    const doc = { userId:user.id, title, kind, content, status, createdAt:now, updatedAt:now };
    const result = await (await getDatabase()).collection("portfolioItems").insertOne(doc);
    return NextResponse.json({ item: { ...doc, id:result.insertedId.toString() } }, { status:201 });
  } catch { return NextResponse.json({ error: "Could not save this project." }, { status:503 }); }
}
export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  try {
    const rate = await checkRateLimit(request, "portfolio-write", 40, 60);
    if (!rate.allowed) return NextResponse.json({ error: "Too many requests. Please wait before trying again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } });
  } catch {
    return NextResponse.json({ error: "Request protection is temporarily unavailable. Please try again." }, { status: 503 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to update portfolio work." }, { status: 401 });
  try {
    const parsed = await readBoundedJson(request, 16_000);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status, headers: { "Cache-Control": "no-store" } });
    const body = parsed.value;
    if (typeof body.id !== "string" || !ObjectId.isValid(body.id)) return NextResponse.json({ error: "Invalid project." }, { status:400 });
    const update: Record<string, unknown> = { updatedAt:new Date() };
    if (typeof body.title === "string" && body.title.trim()) update.title=body.title.trim().slice(0,120);
    if (typeof body.kind === "string") update.kind=body.kind.trim().slice(0,40);
    if (typeof body.content === "string") update.content=body.content.trim().slice(0,12000);
    if (body.status === "draft" || body.status === "published") update.status=body.status;
    const result = await (await getDatabase()).collection("portfolioItems").updateOne({ _id:new ObjectId(body.id), userId:user.id }, { $set:update });
    if (!result.matchedCount) return NextResponse.json({ error: "Project not found." }, { status:404 });
    return NextResponse.json({ ok:true });
  } catch { return NextResponse.json({ error: "Could not update project." }, { status:503 }); }
}
export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  try {
    const rate = await checkRateLimit(request, "portfolio-write", 40, 60);
    if (!rate.allowed) return NextResponse.json({ error: "Too many requests. Please wait before trying again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } });
  } catch {
    return NextResponse.json({ error: "Request protection is temporarily unavailable. Please try again." }, { status: 503 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to delete portfolio work." }, { status:401 });
  try {
    const parsed = await readBoundedJson(request, 4_000);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status, headers: { "Cache-Control": "no-store" } });
    const body = parsed.value;
    if (typeof body.id!=="string" || !ObjectId.isValid(body.id)) return NextResponse.json({error:"Invalid project."},{status:400});
    const result=await (await getDatabase()).collection("portfolioItems").deleteOne({_id:new ObjectId(body.id),userId:user.id});
    if (!result.deletedCount) return NextResponse.json({error:"Project not found."},{status:404});
    return NextResponse.json({ok:true});
  } catch { return NextResponse.json({error:"Could not delete project."},{status:503}); }
}
