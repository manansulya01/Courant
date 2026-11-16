import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/auth";

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin) {
    try { return new URL(origin).origin === new URL(request.url).origin; }
    catch { return false; }
  }
  return request.headers.get("sec-fetch-site") !== "cross-site";
}

export async function checkRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowSeconds = 60,
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const forwarded = request.headers.get("x-forwarded-for");
  const address = request.headers.get("x-real-ip")?.trim() ||
    forwarded?.split(",").map(part => part.trim()).filter(Boolean).at(-1) || "unknown";
  const identity = createHash("sha256").update(address).digest("hex").slice(0, 32);
  const key = createHash("sha256").update(`${scope}:${identity}`).digest("hex");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_key: `${scope}:${key}`,
    p_limit: limit,
    p_window_seconds: windowSeconds,
    p_secret: process.env.COURANT_RATE_LIMIT_SECRET,
  });
  if (error || !data?.[0]) {
    console.error("Shared rate-limit store unavailable.", error?.code || "unknown");
    // Fail closed: security-sensitive endpoints must not silently become unthrottled.
    throw new Error("Shared request protection is unavailable.");
  }
  return data[0].allowed
    ? { allowed: true }
    : { allowed: false, retryAfter: Number(data[0].retry_after) || windowSeconds };
}
