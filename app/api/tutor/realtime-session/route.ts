import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, isSameOrigin } from "@/lib/security";
import { readBoundedJson } from "@/lib/bounded-json";

export const runtime = "nodejs";
export const maxDuration = 20;
const noStore = { "Cache-Control": "no-store" };

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: noStore });
}

const coachInstructions = `You are Courant, a warm, highly capable English conversation coach on a live audio/video call. Speak naturally in clear, everyday English and keep the conversation moving. Treat the learner as a real conversation partner, not a test.

CORRECTION STYLE:
- Help the learner improve while preserving confidence. Do not interrupt every small imperfection.
- When the learner finishes a thought, briefly say the most useful correction in natural English, then invite the learner to try the improved version when it makes sense.
- Prioritize meaning-changing grammar, common phrasing, word choice, and pronunciation only when you have reliable audio evidence. Never pretend to assess pronunciation from text alone.
- Use a compact pattern when helpful: "A more natural way to say that is: …" followed by one short reason. Then continue with one relevant question.
- If the learner's sentence is already natural, say so occasionally and focus on conversation.
- If strict correction is requested, correct more thoroughly. Otherwise, give at most one or two high-value corrections per turn.
- Speak at a moderate pace. Use simple explanations unless the learner asks for advanced detail. Never shame or grade the learner.
- In video mode, use visual information only when relevant and available. Do not claim to see anything not shown in shared frames.
- Keep spoken responses concise so this feels like a real conversation, not a lecture.`;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return fail("Request origin was not accepted.", 403);

  try {
    const rate = await checkRateLimit(request, "realtime-session", 8, 60);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many call attempts. Wait a moment and try again." },
        { status: 429, headers: { ...noStore, "Retry-After": String(rate.retryAfter || 60) } },
      );
    }
  } catch {
    return fail("Request protection is temporarily unavailable. Please try again.", 503);
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) return fail("Live English calls need GEMINI_API_KEY configured on the server.", 503);

  try {
    const parsed = await readBoundedJson(request, 2_048);
    if (!parsed.ok) return fail(parsed.error, parsed.status);
    const mode = parsed.value.mode === "video" ? "video" : "voice";
    const level = parsed.value.level === "beginner" || parsed.value.level === "advanced" ? parsed.value.level : "intermediate";
    const levelGuidance: Record<"beginner" | "intermediate" | "advanced", string> = {
      beginner: "Use short sentences, common vocabulary, one idea at a time, and patient pauses. Explain corrections simply and invite the learner to repeat a natural version.",
      intermediate: "Use natural everyday English. Explain useful grammar or phrasing improvements briefly and encourage longer answers.",
      advanced: "Use nuanced, natural English. Focus on precision, register, collocations, idiomatic phrasing, and conversational flow without overexplaining basic grammar.",
    };
    const scenario = typeof parsed.value.scenario === "string"
      ? parsed.value.scenario.trim().replace(/[<>\u0000-\u001f]/g, "").slice(0, 240)
      : "a friendly everyday English conversation";
    let learnerHint = "";
    try {
      const user = await getCurrentUser();
      if (user) learnerHint = " This is a signed-in learner; adapt gently and never infer ability from account details.";
    } catch {
      // Identity is optional for the live tutor.
    }
    const instructions = `${coachInstructions}\n\nLEARNER LEVEL: ${level}. ${levelGuidance[level]}\nCALL MODE: ${mode}. CONVERSATION CONTEXT: ${scenario || "a friendly everyday English conversation"}.${learnerHint}`;
    const now = Date.now();
    const model = process.env.GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview";
    const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        uses: 1,
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: `models/${model}`,
          config: {
            responseModalities: ["AUDIO"],
            systemInstruction: { parts: [{ text: instructions }] },
            inputAudioTranscription: { languageCodes: ["en-US"] },
            outputAudioTranscription: { languageCodes: ["en-US"] },
            realtimeInputConfig: { automaticActivityDetection: { disabled: false } },
            generationConfig: { temperature: 0.65, speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } } } },
          },
        },
      }),
    });

    if (!upstream.ok) {
      if (upstream.status === 429) return fail("Live voice is busy or the Gemini API quota is exhausted. Check your Google AI Studio usage and try again.", 429);
      const details = await upstream.text().catch(() => "");
      console.error("Gemini live token setup failed:", upstream.status, details.slice(0, 400));
      return fail("Could not start a live call. Check that Gemini Live API is enabled for this Google AI project and model.", 502);
    }

    const data = await upstream.json() as { name?: unknown; expireTime?: unknown };
    if (typeof data.name !== "string" || !data.name) return fail("The live voice service returned an invalid session token.", 502);
    return NextResponse.json(
      { clientSecret: data.name, expiresAt: data.expireTime ?? null, mode, model },
      { headers: { ...noStore, "X-Content-Type-Options": "nosniff" } },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") return fail("Starting the live call took too long. Please try again.", 504);
    return fail("Could not start the live call. Please try again.", 500);
  }
}
