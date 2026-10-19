import { NextResponse } from "next/server";
import { checkRateLimit, isSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 15;
const noStore = { "Cache-Control": "no-store" };

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: noStore });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return fail("Request origin was not accepted.", 403);

  try {
    const rate = await checkRateLimit(request, "avatar-token", 4, 60);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many video-call attempts. Wait a moment and try again." },
        { status: 429, headers: { ...noStore, "Retry-After": String(rate.retryAfter || 60) } },
      );
    }
  } catch {
    return fail("Request protection is temporarily unavailable. Please try again.", 503);
  }

  const apiKey = process.env.LIVEAVATAR_API_KEY;
  const avatarId = process.env.LIVEAVATAR_AVATAR_ID;
  if (!apiKey || !avatarId) {
    return fail("Animated teacher video is not configured yet. Add LIVEAVATAR_API_KEY, LIVEAVATAR_AVATAR_ID, and LIVEAVATAR_CONTEXT_ID on the server. Voice calls remain available.", 503);
  }

  try {
    const response = await fetch("https://api.liveavatar.com/v1/sessions/token", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "FULL", avatar_id: avatarId, avatar_persona: { context_id: process.env.LIVEAVATAR_CONTEXT_ID, language: "en" } }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const details = await response.text().catch(() => "");
      console.error("LiveAvatar session-token request failed:", response.status, details.slice(0, 300));
      return fail(response.status === 429 ? "The avatar service is busy. Please try again shortly." : "Could not start animated teacher video. Verify your LiveAvatar API access, avatar ID, and context ID.", response.status === 429 ? 429 : 502);
    }

    const result = await response.json() as { data?: { session_token?: unknown } };
    if (typeof result.data?.session_token !== "string" || !result.data.session_token) {
      return fail("The avatar service returned an invalid session token.", 502);
    }
    return NextResponse.json({ sessionToken: result.data.session_token }, { headers: { ...noStore, "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") return fail("Animated teacher video took too long to start. Please try again.", 504);
    return fail("Could not start animated teacher video. Please try again.", 502);
  }
}
