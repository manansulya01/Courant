import { NextResponse } from "next/server";
import { checkRateLimit, isSameOrigin } from "@/lib/security";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";
export const runtime = "nodejs";
export const maxDuration = 30;
type Turn = { role: "user" | "assistant"; content: string };
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  try {
    const rate = await checkRateLimit(request, "tutor", 30, 60);
    if (!rate.allowed) return NextResponse.json({ error: "Too many requests. Please wait before trying again." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } });
  } catch {
    return NextResponse.json({ error: "Request protection is temporarily unavailable. Please try again." }, { status: 503 });
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "Courant AI is not connected yet. Add OPENAI_API_KEY to the server environment to enable the AI tutor." }, { status: 503 });
  try {
    const body = await request.json();
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 4000) : "";
    const scenario = typeof body.scenario === "string" ? body.scenario.slice(0, 160) : "Everyday conversation";
    const history: Turn[] = Array.isArray(body.history) ? body.history.slice(-12).filter((t: unknown): t is Turn => !!t && typeof t === "object" && ["user", "assistant"].includes(String((t as Turn).role)) && typeof (t as Turn).content === "string").map((t: Turn) => ({ role: t.role, content: t.content.slice(0, 2000) })) : [];
    const image = typeof body.image === "string" && body.image.startsWith("data:image/") && body.image.length < 5_500_000 ? body.image : null;
    if (!message && !image) return NextResponse.json({ error: "Say something or add a picture to begin." }, { status: 400 });
    let learnerContext = "No saved learner history is available; begin with a gentle check-in and adapt from the conversation.";
    try {
      const user = await getCurrentUser();
      if (user) {
        const recent = await (await getDatabase()).collection("learningProgress").find({ userId: user.id }).sort({ createdAt: -1 }).limit(5).toArray();
        if (recent.length) learnerContext = "Recent saved practice (use as a soft guide, never as a diagnosis): " + recent.map(r => ({lesson:r.lesson,skill:r.skill,score:r.score,completed:r.completed})).map(r => JSON.stringify(r)).join("; ");
      }
    } catch { /* Keep tutoring available when the optional progress store is not configured. */ }
    const content = image ? [{ type: "text", text: message || "Describe this picture in a way that helps me practise English. Ask one friendly follow-up question." }, { type: "image_url", image_url: { url: image, detail: "auto" } }] : message;
    const system = `You are Courant, a patient, encouraging English speaking and listening tutor for school-age learners. Scenario: ${scenario}. ${learnerContext} Use age-appropriate language, short natural spoken turns, and gentle corrections. Ask one question at a time. If the learner makes a language mistake, first respond to their meaning, then offer one natural corrected version without shaming them. Adapt examples and difficulty to observed ability, revisit previous weak areas naturally, and do not treat old scores as definitive. Help them speak, listen, describe what they see, build vocabulary, and practise real-life dialogue. Never claim to measure pronunciation from text. Do not request personal information. Keep most replies under 90 words.`;
    const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", temperature: 0.6, max_tokens: 450, messages: [{ role: "system", content: system }, ...history, { role: "user", content }] }) });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: "The AI tutor could not respond just now. Check your AI provider settings and try again." }, { status: response.status === 429 ? 429 : 502 });
    const reply = data.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) throw new Error("Empty model response");
    return NextResponse.json({ reply: reply.trim(), model: process.env.OPENAI_MODEL || "gpt-4o-mini" });
  } catch { return NextResponse.json({ error: "Something went wrong while talking to your tutor. Please try again." }, { status: 500 }); }
}
