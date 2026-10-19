import { createHash } from "node:crypto";
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
- When the learner finishes a thought, briefly say the most useful correction in natural English, then invite them to repeat or try the improved version when it makes sense.
- Prioritize meaning-changing grammar, common phrasing, word choice, and pronunciation when you have reliable evidence. Never pretend you can assess pronunciation from text alone.
- Use a compact pattern when helpful: "A more natural way to say that is: …" followed by one short reason. Then continue the conversation with one relevant question.
- If the learner's sentence is already natural, say so occasionally and focus on the conversation.
- If the learner asks for strict correction mode, correct more thoroughly. Otherwise, give at most one or two high-value corrections per turn.
- Speak at a moderate pace. Use simple explanations unless the learner asks for advanced detail. Never shame or grade the learner.
- In video mode, use visual information only when relevant and available. Do not claim to see anything that is not in the shared frames.
- If asked to repeat, slow down, explain, or role-play a scenario, do so.
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

  const key = process.env.OPENAI_API_KEY;
  if (!key) return fail("Live English calls need OPENAI_API_KEY configured on the server.", 503);

  try {
    const parsed = await readBoundedJson(request, 2_048);
    if (!parsed.ok) return fail(parsed.error, parsed.status);
    const mode = parsed.value.mode === "video" ? "video" : "voice";
    const scenario = typeof parsed.value.scenario === "string"
      ? parsed.value.scenario.trim().replace(/[<>\u0000-\u001f]/g, "").slice(0, 160)
      : "a friendly everyday English conversation";
    const instructions = `${coachInstructions}\n\nCALL MODE: ${mode}. CONVERSATION CONTEXT: ${scenario || "a friendly everyday English conversation"}.`;

    let safetyIdentifier: string | null = null;
    try {
      const user = await getCurrentUser();
      if (user) safetyIdentifier = createHash("sha256").update(`${process.env.AUTH_SECRET || ""}:${user.id}`).digest("hex");
    } catch {
      // Anonymous calls remain available; identity is optional for provider safety metadata.
    }

    const upstream = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(safetyIdentifier ? { "OpenAI-Safety-Identifier": safetyIdentifier } : {}),
      },
      body: JSON.stringify({
        expires_after: { anchor: "created_at", seconds: 600 },
        session: {
          type: "realtime",
          model: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime",
          instructions,
          audio: {
            input: {
              transcription: { model: process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe", language: "en" },
              turn_detection: { type: "semantic_vad", eagerness: "medium", create_response: true, interrupt_response: true },
            },
            output: { voice: process.env.OPENAI_REALTIME_VOICE || "marin" },
          },
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!upstream.ok) {
      if (upstream.status === 429) return fail("Live voice is busy right now. Please try again shortly.", 429);
      const details = await upstream.text().catch(() => "");
      console.error("Realtime session setup failed:", upstream.status, details.slice(0, 400));
      return fail("Could not start a live call. Check the server OpenAI project has Realtime API access.", 502);
    }

    const data = await upstream.json() as { value?: unknown; expires_at?: unknown };
    if (typeof data.value !== "string" || !data.value) return fail("The live voice service returned an invalid session.", 502);
    return NextResponse.json(
      { clientSecret: data.value, expiresAt: data.expires_at ?? null, mode },
      { headers: { ...noStore, "X-Content-Type-Options": "nosniff" } },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") return fail("Starting the live call took too long. Please try again.", 504);
    return fail("Could not start the live call. Please try again.", 500);
  }
}
