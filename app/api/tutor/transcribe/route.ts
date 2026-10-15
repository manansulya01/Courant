import { NextResponse } from "next/server";
import { checkRateLimit, isSameOrigin } from "@/lib/security";
export const runtime = "nodejs";
export const maxDuration = 45;
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  try {
    const rate = await checkRateLimit(request, "transcribe", 15, 60);
    if (!rate.allowed) return NextResponse.json({ error: "Too many requests. Please wait before trying again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } });
  } catch {
    return NextResponse.json({ error: "Request protection is temporarily unavailable. Please try again." }, { status: 503 });
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "Audio transcription needs OPENAI_API_KEY in the server environment." }, { status: 503 });
  try {
    const form = await request.formData(); const file = form.get("audio"); const language = String(form.get("language") || "en");
    if (!(file instanceof File)) return NextResponse.json({ error: "Record or choose an audio clip first." }, { status: 400 });
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Please keep audio clips under 20 MB." }, { status: 413 });
    const upstream = new FormData(); upstream.append("file", file, file.name || "practice.webm"); upstream.append("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe"); upstream.append("language", language);
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: upstream });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: "We couldn't transcribe that recording. Please try again or type your answer." }, { status: 502 });
    return NextResponse.json({ text: typeof data.text === "string" ? data.text : "" });
  } catch { return NextResponse.json({ error: "Audio processing failed. Please try recording again." }, { status: 500 }); }
}
