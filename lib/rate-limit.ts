import { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS } from "@/lib/config";

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Simple fixed-window in-memory rate limiter.
 *
 * Documented limitation: state lives in the running Node process, so it is
 * per-instance (doesn't survive restarts or work across serverless regions).
 * For production you'd swap this for Redis/postgres-backed limiting.
 */
const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  bucket.count += 1;
  if (bucket.count > RATE_LIMIT_MAX_REQUESTS) return false;
  return true;
}

/** Best-effort client identification for the single-user college project. */
export function clientKeyFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "local";
}
