import { NextResponse } from "next/server";
import { checkRateLimit, isSameOrigin } from "@/lib/security";
import { readBoundedBytes } from "@/lib/bounded-json";

export const runtime = "nodejs";
export const maxDuration = 45;
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403, headers: noStore });
  try {
    const rate = await checkRateLimit(request, "transcribe", 15, 60);
    if (!rate.allowed) return NextResponse.json({ error: "Too many requests. Please wait before trying again." }, { status: 429, headers: { ...noStore, "Retry-After": String(rate.retryAfter || 60) } });
  } catch {
    return NextResponse.json({ error: "Request protection is temporarily unavailable. Please try again." }, { status: 503, headers: noStore });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "Audio transcription needs OPENAI_API_KEY in the server environment." }, { status: 503, headers: noStore });

  try {
    const bounded = await readBoundedBytes(request, 21 * 1024 * 1024);
    if (!bounded.ok) {
      const error = bounded.status === 413 ? "Please keep audio clips under 20 MB." : "That recording could not be read. Please record again.";
      return NextResponse.json({ error }, { status: bounded.status, headers: noStore });
    }
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    const bodyBuffer = new ArrayBuffer(bounded.bytes.byteLength);
    new Uint8Array(bodyBuffer).set(bounded.bytes);
    const boundedRequest = new Request(request.url, { method: "POST", headers, body: bodyBuffer });
    const form = await boundedRequest.formData();
    const file = form.get("audio");
    const languageValue = form.get("language");
    const language = typeof languageValue === "string" && /^[a-z]{2,3}(-[A-Z]{2})?$/.test(languageValue) ? languageValue : "en";
    if (!(file instanceof File)) return NextResponse.json({ error: "Record or choose an audio clip first." }, { status: 400, headers: noStore });
    if (file.size === 0) return NextResponse.json({ error: "That recording is empty. Please record again." }, { status: 400, headers: noStore });
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Please keep audio clips under 20 MB." }, { status: 413, headers: noStore });
    if (!file.type.startsWith("audio/")) return NextResponse.json({ error: "Please provide an audio recording." }, { status: 415, headers: noStore });

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
      if (response.status === 429) return NextResponse.json({ error: "Audio service is busy. Please wait a moment and try again." }, { status: 429, headers: noStore });
      return NextResponse.json({ error: "We couldn't transcribe that recording. Please try again or type your answer." }, { status: 502, headers: noStore });
    }
    const data: unknown = await response.json();
    const text = (data as { text?: unknown }).text;
    return NextResponse.json({ text: typeof text === "string" ? text.slice(0, 4000) : "" }, { headers: noStore });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "That recording could not be read. Please record again." }, { status: 400, headers: noStore });
    if (error instanceof Error && error.name === "TimeoutError") return NextResponse.json({ error: "Audio processing took too long. Please try recording again." }, { status: 504, headers: noStore });
    return NextResponse.json({ error: "Audio processing failed. Please try recording again." }, { status: 500, headers: noStore });
  }
}
