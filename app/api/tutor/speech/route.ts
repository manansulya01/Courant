import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "AI voice needs OPENAI_API_KEY in the server environment." }, { status: 503, headers: { "Cache-Control": "no-store" } });

  try {
    const body: unknown = await request.json();
    const text = body && typeof body === "object" && typeof (body as { text?: unknown }).text === "string"
      ? (body as { text: string }).text.trim().slice(0, 2500)
      : "";
    if (!text) return NextResponse.json({ error: "Text is required." }, { status: 400 });
    if (text.length < 2) return NextResponse.json({ error: "Please provide a little more text to speak." }, { status: 400 });

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
        voice: "coral",
        input: text,
        response_format: "mp3",
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) {
      if (response.status === 429) return NextResponse.json({ error: "Voice service is busy. Please try again in a moment." }, { status: 429 });
      return NextResponse.json({ error: "Voice playback is temporarily unavailable." }, { status: 502 });
    }

    return new Response(await response.arrayBuffer(), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "That request could not be read." }, { status: 400 });
    if (error instanceof Error && error.name === "TimeoutError") return NextResponse.json({ error: "Voice generation took too long. Please try again." }, { status: 504 });
    return NextResponse.json({ error: "Voice playback failed. Please try again." }, { status: 500 });
  }
}
