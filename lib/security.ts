import { createSupabaseServerClient } from "@/lib/auth";
import { createRateLimitKey } from "@/lib/rate-limit-key";

export function isSameOrigin(request: Request): boolean {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const suppliedOrigin = new URL(origin).origin;
      const acceptedOrigins = new Set([requestUrl.origin]);
      // Render and other reverse proxies may expose an internal origin in request.url.
      // Compare against the public forwarded host/protocol as well, without accepting
      // an arbitrary Origin supplied by the browser.
      const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
      const host = forwardedHost || request.headers.get("host");
      const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
      if (host) acceptedOrigins.add(`${forwardedProto || requestUrl.protocol.replace(":", "")}://${host}`);
      return acceptedOrigins.has(suppliedOrigin);
    } catch {
      return false;
    }
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
  const key = createRateLimitKey(scope, address);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_key: key,
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
