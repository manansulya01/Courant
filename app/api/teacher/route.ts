import { NextResponse } from "next/server";
import { checkRateLimit, isSameOrigin } from "@/lib/security";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
export const runtime = "nodejs";
async function teacher() {
  const user=await getCurrentUser();
  if (!user) return { error:NextResponse.json({error:"Sign in to access teacher tools."},{status:401}) };
  if (!["teacher","admin"].includes(user.role)) return { error:NextResponse.json({error:"Teacher permissions are required."},{status:403}) };
  return {user};
}
export async function GET() {
  const access=await teacher(); if ("error" in access) return access.error;
  try {
    const db=await getDatabase();
    const classes=await db.collection("classes").find({teacherId:access.user.id}).sort({createdAt:-1}).limit(100).toArray();
    const assignments=await db.collection("assignments").find({teacherId:access.user.id}).sort({createdAt:-1}).limit(100).toArray();
    const classIds=classes.map(c=>c._id.toString());
    const progress=classIds.length ? await db.collection("learningProgress").aggregate([
      {$match:{classId:{$in:classIds}}},
      {$group:{_id:"$userId",sessions:{$sum:1},minutes:{$sum:"$minutes"},lastActive:{$max:"$createdAt"}}}
    ]).toArray() : [];
    return NextResponse.json({classes:classes.map(({_id,...c})=>({...c,id:_id.toString()})),assignments:assignments.map(({_id,...a})=>({...a,id:_id.toString()})),activity:progress.map(p=>({userId:p._id,sessions:p.sessions,minutes:p.minutes,lastActive:p.lastActive}))});
  } catch { return NextResponse.json({error:"Could not load teacher workspace."},{status:503}); }
}
export async function POST(request:Request) {
  const access=await teacher(); if ("error" in access) return access.error;
  try {
    const body=await request.json();
    const type=body.type;
    const db=await getDatabase(); const now=new Date();
    if(type==="class") {
      const name=typeof body.name==="string"?body.name.trim().slice(0,100):"";
      const description=typeof body.description==="string"?body.description.trim().slice(0,500):"";
      if(name.length<2) return NextResponse.json({error:"Class name must be at least 2 characters."},{status:400});
      const joinCode=Array.from(crypto.getRandomValues(new Uint8Array(4))).map(v=>(v%36).toString(36)).join("").toUpperCase();
      const doc={teacherId:access.user.id,name,description,joinCode,studentIds:[],createdAt:now,updatedAt:now};
      const result=await db.collection("classes").insertOne(doc);
      return NextResponse.json({class:{...doc,id:result.insertedId.toString()}},{status:201});
    }
    if(type==="assignment") {
      const title=typeof body.title==="string"?body.title.trim().slice(0,120):"";
      const instructions=typeof body.instructions==="string"?body.instructions.trim().slice(0,3000):"";
      const classId=typeof body.classId==="string"&&ObjectId.isValid(body.classId)?body.classId:"";
      const dueDate=typeof body.dueDate==="string"&&body.dueDate?new Date(body.dueDate):null;
      if(title.length<2||!instructions||!classId) return NextResponse.json({error:"Add a title, instructions, and class."},{status:400});
      const cls=await db.collection("classes").findOne({_id:new ObjectId(classId),teacherId:access.user.id});
      if(!cls) return NextResponse.json({error:"Class not found."},{status:404});
      const doc={teacherId:access.user.id,classId,title,instructions,dueDate:dueDate&&!Number.isNaN(dueDate.getTime())?dueDate:null,createdAt:now,updatedAt:now};
      const result=await db.collection("assignments").insertOne(doc);
      return NextResponse.json({assignment:{...doc,id:result.insertedId.toString()}},{status:201});
    }
    return NextResponse.json({error:"Choose class or assignment."},{status:400});
  } catch { return NextResponse.json({error:"Could not save teacher workspace changes."},{status:503}); }
}
export async function DELETE(request:Request) {
  const access=await teacher(); if ("error" in access) return access.error;
  try {
    const body=await request.json();
    if(!["class","assignment"].includes(body.type)||typeof body.id!=="string"||!ObjectId.isValid(body.id)) return NextResponse.json({error:"Invalid item."},{status:400});
    const collection=body.type==="class"?"classes":"assignments";
    const result=await (await getDatabase()).collection(collection).deleteOne({_id:new ObjectId(body.id),teacherId:access.user.id});
    if(!result.deletedCount) return NextResponse.json({error:"Item not found."},{status:404});
    return NextResponse.json({ok:true});
  } catch { return NextResponse.json({error:"Could not delete item."},{status:503}); }
}
