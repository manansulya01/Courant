import { NextResponse } from "next/server";
import { checkRateLimit, isSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 30;
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403, headers: noStore });
  try {
    const rate = await checkRateLimit(request, "speech", 30, 60);
    if (!rate.allowed) return NextResponse.json({ error: "Too many requests. Please wait before trying again." }, { status: 429, headers: { ...noStore, "Retry-After": String(rate.retryAfter || 60) } });
  } catch {
    return NextResponse.json({ error: "Request protection is temporarily unavailable. Please try again." }, { status: 503, headers: noStore });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "AI voice needs OPENAI_API_KEY in the server environment." }, { status: 503, headers: noStore });

  try {
    const body: unknown = await request.json();
    const text = body && typeof body === "object" && typeof (body as { text?: unknown }).text === "string"
      ? (body as { text: string }).text.trim().slice(0, 2500)
      : "";
    if (!text) return NextResponse.json({ error: "Text is required." }, { status: 400, headers: noStore });
    if (text.length < 2) return NextResponse.json({ error: "Please provide a little more text to speak." }, { status: 400, headers: noStore });

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts", voice: "coral", input: text, response_format: "mp3" }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) {
      if (response.status === 429) return NextResponse.json({ error: "Voice service is busy. Please try again in a moment." }, { status: 429, headers: noStore });
      return NextResponse.json({ error: "Voice playback is temporarily unavailable." }, { status: 502, headers: noStore });
    }
    return new Response(await response.arrayBuffer(), {
      headers: { "Content-Type": "audio/mpeg", ...noStore, "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "That request could not be read." }, { status: 400, headers: noStore });
    if (error instanceof Error && error.name === "TimeoutError") return NextResponse.json({ error: "Voice generation took too long. Please try again." }, { status: 504, headers: noStore });
    return NextResponse.json({ error: "Voice playback failed. Please try again." }, { status: 500, headers: noStore });
  }
}
