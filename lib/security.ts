import { createHash } from "node:crypto";
import { getDatabase } from "@/lib/mongodb";

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).origin === new URL(request.url).origin;
    } catch {
      return false;
    }
  }
  return request.headers.get("sec-fetch-site") !== "cross-site";
}

let rateLimitIndexReady: Promise<void> | undefined;

async function ensureRateLimitIndex(): Promise<void> {
  if (!rateLimitIndexReady) {
    rateLimitIndexReady = getDatabase()
      .then(async (db) => {
        await db.collection("rateLimits").createIndex(
          { expiresAt: 1 },
          { expireAfterSeconds: 0, name: "rate_limit_expiry" },
        );
      })
      .catch((error: unknown) => {
        rateLimitIndexReady = undefined;
        throw error;
      });
  }
  await rateLimitIndexReady;
}

const emergencyCounters = new Map<string, { count: number; resetAt: number }>();

function emergencyRateLimit(identity: string, scope: string, limit: number, windowSeconds: number, now: Date) {
  const bucket = Math.floor(now.getTime() / (windowSeconds * 1000));
  const resetAt = (bucket + 1) * windowSeconds * 1000;
  for (const [key, value] of emergencyCounters) if (value.resetAt <= now.getTime()) emergencyCounters.delete(key);
  if (emergencyCounters.size > 5000) {
    const firstKey = emergencyCounters.keys().next().value;
    if (firstKey) emergencyCounters.delete(firstKey);
  }
  const key = `${scope}:${identity}:${bucket}`;
  const count = (emergencyCounters.get(key)?.count ?? 0) + 1;
  emergencyCounters.set(key, { count, resetAt });
  return count > limit
    ? { allowed: false, retryAfter: Math.max(1, Math.ceil((resetAt - now.getTime()) / 1000)) }
    : { allowed: true };
}

export async function checkRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowSeconds = 60,
): Promise<{ allowed: boolean; retryAfter?: number }> {
  // Prefer the hosting proxy's real IP header; never trust the leftmost forwarded value.
  const forwarded = request.headers.get("x-forwarded-for");
  const address = request.headers.get("x-real-ip")?.trim() ||
    forwarded?.split(",").map((part) => part.trim()).filter(Boolean).at(-1) ||
    "unknown";
  const identity = createHash("sha256").update(address).digest("hex").slice(0, 32);
  const now = new Date();
  const bucket = Math.floor(now.getTime() / (windowSeconds * 1000));
  const resetAt = new Date((bucket + 1) * windowSeconds * 1000);
  const id = `${scope}:${identity}:${bucket}`;
  try {
    const db = await getDatabase();
    await ensureRateLimitIndex();
    const counters = db.collection<{ _id: string; count: number; expiresAt: Date; createdAt: Date }>("rateLimits");
    const result = await counters.findOneAndUpdate(
      { _id: id },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: resetAt, createdAt: now } },
      { upsert: true, returnDocument: "after" },
    );
    const count = result && typeof result.count === "number" ? result.count : limit + 1;
    if (count > limit) return { allowed: false, retryAfter: Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000)) };
    return { allowed: true };
  } catch (error) {
    console.error("Shared rate-limit store unavailable; applying emergency per-instance rate limit.", error);
    return emergencyRateLimit(identity, scope, limit, windowSeconds, now);
  }
}
