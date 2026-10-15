import {NextResponse} from "next/server";import {getCurrentUser} from "@/lib/auth";import {getDatabase} from "@/lib/mongodb";
import { checkRateLimit, isSameOrigin } from "@/lib/security";
export const runtime="nodejs";
export async function POST(request:Request){
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  try {
    const rate = await checkRateLimit(request, "class-join", 8, 60);
    if (!rate.allowed) return NextResponse.json({ error: "Too many requests. Please wait before trying again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } });
  } catch {
    return NextResponse.json({ error: "Request protection is temporarily unavailable. Please try again." }, { status: 503 });
  }const user=await getCurrentUser();if(!user)return NextResponse.json({error:"Sign in to join a class."},{status:401});if(user.role!=="student")return NextResponse.json({error:"Only student accounts can join a class."},{status:403});try{const body=await request.json();const code=typeof body.code==="string"?body.code.trim().toUpperCase():"";if(!/^[A-Z0-9]{4}$/.test(code))return NextResponse.json({error:"Enter the four-character class code."},{status:400});const db=await getDatabase();const cls=await db.collection("classes").findOne({joinCode:code});if(!cls)return NextResponse.json({error:"That class code was not found."},{status:404});await db.collection("classes").updateOne({_id:cls._id},{$addToSet:{studentIds:user.id},$set:{updatedAt:new Date()}});return NextResponse.json({ok:true,class:{id:cls._id.toString(),name:cls.name}})}catch{return NextResponse.json({error:"Could not join class."},{status:503})}}
