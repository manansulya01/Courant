import { createHash } from "node:crypto";

/**
 * Creates the opaque, fixed-width key accepted by public.consume_rate_limit.
 * The SQL function deliberately accepts a 128-bit hex suffix, not a full
 * SHA-256 digest, so keep this format in sync with its input validation.
 */
export function createRateLimitKey(scope: string, address: string): string {
  const identity = createHash("sha256").update(address).digest("hex").slice(0, 32);
  const digest = createHash("sha256").update(`${scope}:${identity}`).digest("hex").slice(0, 32);
  return `${scope}:${digest}`;
}
