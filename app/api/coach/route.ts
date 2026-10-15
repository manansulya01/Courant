import {NextResponse} from "next/server";
import { checkRateLimit, isSameOrigin } from "@/lib/security";
export async function POST(request:Request){
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  try {
    const rate = await checkRateLimit(request, "coach", 30, 60);
    if (!rate.allowed) return NextResponse.json({ error: "Too many requests. Please wait before trying again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } });
  } catch {
    return NextResponse.json({ error: "Request protection is temporarily unavailable. Please try again." }, { status: 503 });
  }
 const body=await request.json().catch(()=>({}));
 const transcript=typeof body.transcript==="string"?body.transcript.trim():"";
 if(!transcript)return NextResponse.json({error:"A transcript is required."},{status:400});
 const words=transcript.toLowerCase().match(/[a-z']+/g)||[];
 const count=words.length;
 const fillers=(transcript.match(/\b(um|uh|like|you know|basically)\b/gi)||[]).length;
 const longWords=words.filter((w:string)=>w.length>=7).length;
 const clarity=Math.max(45,Math.min(97,Math.round(62+Math.min(count,35)*.7-fillers*3)));
 const confidence=Math.max(45,Math.min(96,Math.round(64+Math.min(count,45)*.55-fillers*2)));
 const vocabulary=Math.max(45,Math.min(96,Math.round(60+Math.min(longWords,12)*2.5)));
 let tip="Good effort. Try adding one specific example to make your main point more memorable.";
 if(count<8)tip="Try a complete sentence or two. Add a little context so your listener understands your point.";
 else if(fillers>1)tip="You used a few filler words. Pause silently for a moment instead of filling the space with “um” or “like”.";
 else if(count>45)tip="Your response has plenty of detail. Break it into shorter ideas and pause between them to help the listener follow.";
 else if(longWords<2)tip="Try adding one precise word or concrete example to make your response more vivid.";
 const scenario=typeof body.scenario==="string"?body.scenario:"this scenario";
 const reply=count<8?"Thanks for starting. Can you tell me a little more about that?":fillers>1?"I understand your point. Try that again, using a short silent pause when you need time to think.": "That gives me a good sense of your thinking. "+tip;
 return NextResponse.json({reply,feedback:{clarity,confidence,pace:vocabulary,tip},transcript,wordCount:count,scenario});
}