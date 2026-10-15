import { NextResponse } from "next/server";
import { checkRateLimit, isSameOrigin } from "@/lib/security";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  try {
    const rate = await checkRateLimit(request, "speech", 30, 60);
    if (!rate.allowed) return NextResponse.json({ error: "Too many requests. Please wait before trying again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } });
  } catch {
    return NextResponse.json({ error: "Request protection is temporarily unavailable. Please try again." }, { status: 503 });
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "AI voice needs OPENAI_API_KEY in the server environment." }, { status: 503 });
  try {
    const body = await request.json(); const text = typeof body.text === "string" ? body.text.trim().slice(0, 3500) : "";
    if (!text) return NextResponse.json({ error: "Text is required." }, { status: 400 });
    const response = await fetch("https://api.openai.com/v1/audio/speech", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts", voice: "coral", input: text, response_format: "mp3" }) });
    if (!response.ok) return NextResponse.json({ error: "Voice playback is temporarily unavailable." }, { status: 502 });
    return new Response(await response.arrayBuffer(), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Voice playback failed. Please try again." }, { status: 500 }); }
}
