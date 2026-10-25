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

  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "Audio transcription is not configured. Add GEMINI_API_KEY to the server environment." }, { status: 503, headers: noStore });

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

    const mimeType = file.type.split(";")[0].trim().toLowerCase() || "audio/webm";
    const audioBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const model = process.env.GEMINI_TRANSCRIPTION_MODEL || process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [
          { text: `Transcribe the spoken audio accurately in its original language (${language}). Return only the words that were spoken. Do not translate, summarize, add commentary, or include labels. If no intelligible speech is present, return an empty response.` },
          { inlineData: { mimeType, data: audioBase64 } },
        ] }],
        generationConfig: { temperature: 0, maxOutputTokens: 600 },
      }),
      signal: AbortSignal.timeout(35_000),
    });
    if (!response.ok) {
      if (response.status === 429) return NextResponse.json({ error: "Gemini audio service is busy. Please wait a moment and try again." }, { status: 429, headers: noStore });
      const details = await response.text().catch(() => "");
      console.error("Gemini transcription request failed:", response.status, details.slice(0, 300));
      return NextResponse.json({ error: "We couldn't transcribe that recording. Check Gemini audio support and quota, then try again." }, { status: 502, headers: noStore });
    }
    const data = await response.json() as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.map(part => typeof part.text === "string" ? part.text : "").join("").trim() || "";
    return NextResponse.json({ text: text.slice(0, 4000) }, { headers: noStore });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "That recording could not be read. Please record again." }, { status: 400, headers: noStore });
    if (error instanceof Error && error.name === "TimeoutError") return NextResponse.json({ error: "Audio processing took too long. Please try recording again." }, { status: 504, headers: noStore });
    return NextResponse.json({ error: "Audio processing failed. Please try recording again." }, { status: 500, headers: noStore });
  }
}
