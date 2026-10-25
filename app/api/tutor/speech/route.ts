import { NextResponse } from "next/server";
import { checkRateLimit, isSameOrigin } from "@/lib/security";
import { readBoundedJson } from "@/lib/bounded-json";

export const runtime = "nodejs";
export const maxDuration = 30;
const noStore = { "Cache-Control": "no-store" };

function pcmToWav(pcm: Buffer, sampleRate = 24000) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403, headers: noStore });
  try {
    const rate = await checkRateLimit(request, "speech", 30, 60);
    if (!rate.allowed) return NextResponse.json({ error: "Too many requests. Please wait before trying again." }, { status: 429, headers: { ...noStore, "Retry-After": String(rate.retryAfter || 60) } });
  } catch {
    return NextResponse.json({ error: "Request protection is temporarily unavailable. Please try again." }, { status: 503, headers: noStore });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "AI voice is not configured. Add GEMINI_API_KEY to the server environment." }, { status: 503, headers: noStore });

  try {
    const parsed = await readBoundedJson(request, 16_000);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status, headers: noStore });
    const text = typeof parsed.value.text === "string" ? parsed.value.text.trim().slice(0, 2500) : "";
    if (text.length < 2) return NextResponse.json({ error: "Please provide a little more text to speak." }, { status: 400, headers: noStore });

    const model = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Read the following English text naturally and clearly, with a warm, encouraging tone. Do not add, omit, or explain any words. Text to speak:\n${text}` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } } },
        },
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) {
      if (response.status === 429) return NextResponse.json({ error: "Gemini voice is busy. Please try again in a moment." }, { status: 429, headers: noStore });
      const details = await response.text().catch(() => "");
      console.error("Gemini speech request failed:", response.status, details.slice(0, 300));
      return NextResponse.json({ error: "Voice playback is temporarily unavailable. Check Gemini TTS model access and quota." }, { status: 502, headers: noStore });
    }

    const data = await response.json() as { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[] };
    const audioPart = data.candidates?.[0]?.content?.parts?.find(part => part.inlineData?.data)?.inlineData;
    if (!audioPart?.data) return NextResponse.json({ error: "Gemini did not return audio. Please try again." }, { status: 502, headers: noStore });
    const audioBytes = Buffer.from(audioPart.data, "base64");
    const mimeType = audioPart.mimeType || "audio/pcm;rate=24000";
    const wav = mimeType.startsWith("audio/pcm") || mimeType.startsWith("audio/L16") ? pcmToWav(audioBytes) : audioBytes;
    const contentType = wav === audioBytes ? mimeType.split(";")[0] : "audio/wav";
    return new Response(new Uint8Array(wav), {
      headers: { "Content-Type": contentType, ...noStore, "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "That request could not be read." }, { status: 400, headers: noStore });
    if (error instanceof Error && error.name === "TimeoutError") return NextResponse.json({ error: "Voice generation took too long. Please try again." }, { status: 504, headers: noStore });
    return NextResponse.json({ error: "Voice playback failed. Please try again." }, { status: 500, headers: noStore });
  }
}
