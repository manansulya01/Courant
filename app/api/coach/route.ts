import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 5;

const MAX_BODY_BYTES = 24_000;
const MAX_TRANSCRIPT_LENGTH = 20_000;
const noStore = { "Cache-Control": "no-store" };

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: noStore });
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return errorResponse("That transcript is too long. Please submit a shorter practice answer.", 413);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Please send a valid practice transcript.", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return errorResponse("Please send a valid practice transcript.", 400);
  }

  const input = body as Record<string, unknown>;
  const transcript = typeof input.transcript === "string" ? input.transcript.trim() : "";
  if (!transcript) return errorResponse("A transcript is required.", 400);
  if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
    return errorResponse("That transcript is too long. Please submit a shorter practice answer.", 413);
  }

  const words = transcript.toLowerCase().match(/[a-z']+/g) || [];
  const wordCount = words.length;
  const fillers = (transcript.match(/\b(um|uh|like|you know|basically)\b/gi) || []).length;
  const longWords = words.filter(word => word.length >= 7).length;

  // These are transparent text-based practice indicators, not objective speech measurements.
  const clarity = Math.max(45, Math.min(97, Math.round(62 + Math.min(wordCount, 35) * 0.7 - fillers * 3)));
  const confidence = Math.max(45, Math.min(96, Math.round(64 + Math.min(wordCount, 45) * 0.55 - fillers * 2)));
  const vocabulary = Math.max(45, Math.min(96, Math.round(60 + Math.min(longWords, 12) * 2.5)));

  let tip = "Good effort. Try adding one specific example to make your main point more memorable.";
  if (wordCount < 8) {
    tip = "Try a complete sentence or two. Add a little context so your listener understands your point.";
  } else if (fillers > 1) {
    tip = "You used a few common filler words. Try a short, silent pause when you need time to think.";
  } else if (wordCount > 45) {
    tip = "Your response has plenty of detail. Break it into shorter ideas and pause between them to help the listener follow.";
  } else if (longWords < 2) {
    tip = "Try adding one precise word or concrete example to make your response more vivid.";
  }

  const reply = wordCount < 8
    ? "Thanks for starting. Can you tell me a little more about that?"
    : fillers > 1
      ? "I understand your point. Try that again, using a short silent pause when you need time to think."
      : "That gives me a good sense of your thinking. " + tip;
  const scenario = typeof input.scenario === "string" ? input.scenario.trim().slice(0, 120) : "this scenario";

  return NextResponse.json({
    reply,
    feedback: { clarity, confidence, pace: vocabulary, tip },
    feedbackBasis: "text-only-estimate",
    feedbackDisclaimer: "These practice indicators are estimated from transcript text. They do not measure pronunciation, speaking speed, emotion, or actual confidence.",
    transcript,
    wordCount,
    scenario,
  }, { headers: noStore });
}
