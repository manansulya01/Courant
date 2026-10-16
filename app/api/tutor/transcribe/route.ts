import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(request: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "Audio transcription needs OPENAI_API_KEY in the server environment." }, { status: 503, headers: { "Cache-Control": "no-store" } });

  try {
    const form = await request.formData();
    const file = form.get("audio");
    const languageValue = form.get("language");
    const language = typeof languageValue === "string" && /^[a-z]{2,3}(-[A-Z]{2})?$/.test(languageValue) ? languageValue : "en";

    if (!(file instanceof File)) return NextResponse.json({ error: "Record or choose an audio clip first." }, { status: 400 });
    if (file.size === 0) return NextResponse.json({ error: "That recording is empty. Please record again." }, { status: 400 });
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Please keep audio clips under 20 MB." }, { status: 413 });
    if (!file.type.startsWith("audio/")) return NextResponse.json({ error: "Please provide an audio recording." }, { status: 415 });

    const upstream = new FormData();
    upstream.append("file", file, file.name || "practice.webm");
    upstream.append("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe");
    upstream.append("language", language);

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: upstream,
      signal: AbortSignal.timeout(35_000),
    });

    if (!response.ok) {
      if (response.status === 429) return NextResponse.json({ error: "Audio service is busy. Please wait a moment and try again." }, { status: 429 });
      return NextResponse.json({ error: "We couldn't transcribe that recording. Please try again or type your answer." }, { status: 502 });
    }

    const data: unknown = await response.json();
    const text = (data as { text?: unknown }).text;
    return NextResponse.json(
      { text: typeof text === "string" ? text.slice(0, 4000) : "" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") return NextResponse.json({ error: "Audio processing took too long. Please try recording again." }, { status: 504 });
    return NextResponse.json({ error: "Audio processing failed. Please try recording again." }, { status: 500 });
  }
}
